const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { verificarToken } = require('./middlewares/authMiddleware');

const router = express.Router();
const sql = db.promise();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

function calcularPrioridad(idCategoria, descripcion) {
    const text = descripcion.toLowerCase();
    const critical = ['accidente', 'herido', 'bloqueo total', 'riesgo inmediato', 'incendio', 'sin funcionar'];
    const high = ['peligro', 'profundo', 'avenida', 'interseccion', 'escuela', 'hospital', 'desbordado'];
    if (critical.some((term) => text.includes(term))) return 4;
    if (Number(idCategoria) === 3 || high.some((term) => text.includes(term))) return 3;
    return Number(idCategoria) === 1 ? 2 : 2;
}

const detalleSql = `
    SELECT i.*, u.nombre_completo AS ciudadano, c.nombre AS categoria_nombre,
           c.color AS categoria_color, e.nombre AS estado_nombre, e.color AS estado_color,
           p.nombre AS prioridad_nombre, p.nivel AS prioridad_nivel,
           z.nombre AS zona_nombre
    FROM incidencias i
    JOIN usuarios u ON u.id_usuario = i.id_usuario
    JOIN categorias c ON c.id_categoria = i.id_categoria
    JOIN estados e ON e.id_estado = i.id_estado
    JOIN prioridades p ON p.id_prioridad = i.id_prioridad
    LEFT JOIN zonas z ON z.id_zona = i.id_zona
    WHERE i.eliminado_en IS NULL`;

router.get('/catalogos', verificarToken, async (req, res) => {
    try {
        const [[categorias], [estados], [prioridades], [zonas]] = await Promise.all([
            sql.query('SELECT * FROM categorias WHERE activo = TRUE ORDER BY id_categoria'),
            sql.query('SELECT * FROM estados WHERE activo = TRUE ORDER BY orden_visual'),
            sql.query('SELECT * FROM prioridades WHERE activo = TRUE ORDER BY nivel'),
            sql.query('SELECT * FROM zonas WHERE activo = TRUE ORDER BY nombre'),
        ]);
        res.json({ categorias, estados, prioridades, zonas });
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar catalogos' });
    }
});

router.get('/todas', verificarToken, async (req, res) => {
    try {
        const { categoria, estado, prioridad, desde, hasta } = req.query;
        const conditions = [];
        const params = [];
        if (categoria) { conditions.push('i.id_categoria = ?'); params.push(categoria); }
        if (estado) { conditions.push('i.id_estado = ?'); params.push(estado); }
        if (prioridad) { conditions.push('i.id_prioridad = ?'); params.push(prioridad); }
        if (desde) { conditions.push('DATE(i.fecha_reporte) >= ?'); params.push(desde); }
        if (hasta) { conditions.push('DATE(i.fecha_reporte) <= ?'); params.push(hasta); }
        if (req.usuario.rol === 1) { conditions.push('(i.id_estado IN (1,2,6) OR i.id_usuario = ?)'); params.push(req.usuario.id); }
        const suffix = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
        const [rows] = await sql.execute(`${detalleSql}${suffix} ORDER BY p.nivel DESC, i.fecha_reporte DESC`, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener incidencias' });
    }
});

router.get('/mis-reportes', verificarToken, async (req, res) => {
    try {
        const [rows] = await sql.execute(`${detalleSql} AND i.id_usuario = ? ORDER BY i.fecha_reporte DESC`, [req.usuario.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tus reportes' });
    }
});

router.get('/:id/detalle', verificarToken, async (req, res) => {
    try {
        const [[incidencias], [historial], [archivos], [comentarios], [asignaciones]] = await Promise.all([
            sql.execute(`${detalleSql} AND i.id_incidencia = ? AND (? <> 1 OR i.id_usuario = ?)`, [req.params.id, req.usuario.rol, req.usuario.id]),
            sql.execute(`SELECT h.*, ea.nombre AS estado_anterior, en.nombre AS estado_nuevo, u.nombre_completo AS autor
                         FROM historial_estados h
                         LEFT JOIN estados ea ON ea.id_estado=h.id_estado_anterior
                         JOIN estados en ON en.id_estado=h.id_estado_nuevo
                         LEFT JOIN usuarios u ON u.id_usuario=h.cambiado_por
                         WHERE h.id_incidencia=? ORDER BY h.creado_en`, [req.params.id]),
            sql.execute('SELECT * FROM incidencia_archivos WHERE id_incidencia=? ORDER BY creado_en', [req.params.id]),
            sql.execute(`SELECT c.*, u.nombre_completo AS autor FROM comentarios_incidencia c
                         JOIN usuarios u ON u.id_usuario=c.id_usuario
                         WHERE c.id_incidencia=? AND c.eliminado_en IS NULL AND (c.es_interno=FALSE OR ? <> 1)
                         ORDER BY c.creado_en`, [req.params.id, req.usuario.rol]),
            sql.execute(`SELECT a.*, o.nombre_completo AS operador, q.nombre AS cuadrilla
                         FROM asignaciones a LEFT JOIN usuarios o ON o.id_usuario=a.id_operador
                         LEFT JOIN cuadrillas q ON q.id_cuadrilla=a.id_cuadrilla
                         WHERE a.id_incidencia=? ORDER BY a.fecha_asignacion DESC`, [req.params.id]),
        ]);
        if (!incidencias.length) return res.status(404).json({ error: 'Incidencia no encontrada' });
        res.json({ incidencia: incidencias[0], historial, archivos, comentarios, asignaciones });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al consultar el detalle' });
    }
});

router.post('/registrar', verificarToken, upload.single('foto'), async (req, res) => {
    const { id_categoria, descripcion, latitud, longitud, titulo, direccion_referencia, id_zona } = req.body;
    if (!req.file) return res.status(400).json({ error: 'La foto es obligatoria' });
    if (!id_categoria || !descripcion?.trim() || !latitud || !longitud) {
        return res.status(400).json({ error: 'Categoria, descripcion y ubicacion son obligatorias' });
    }

    try {
        const idPrioridad = calcularPrioridad(id_categoria, descripcion);
        const [result] = await sql.execute(
            `INSERT INTO incidencias
             (codigo, id_usuario, id_categoria, id_estado, id_prioridad, id_zona, titulo,
              descripcion, direccion_referencia, latitud, longitud, foto_reporte)
             VALUES (NULL, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.usuario.id, id_categoria, idPrioridad, id_zona || null, titulo?.trim() || null,
             descripcion.trim(), direccion_referencia?.trim() || null, latitud, longitud, req.file.filename],
        );
        const codigo = `INC-${new Date().getFullYear()}-${String(result.insertId).padStart(6, '0')}`;
        await sql.execute('UPDATE incidencias SET codigo=? WHERE id_incidencia=?', [codigo, result.insertId]);
        await sql.execute(
            `INSERT INTO incidencia_archivos
             (id_incidencia,id_usuario,tipo,nombre_archivo,ruta_archivo,mime_type,tamano_bytes,descripcion)
             VALUES (?,?, 'reporte', ?, ?, ?, ?, 'Evidencia inicial')`,
            [result.insertId, req.usuario.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size],
        );
        res.status(201).json({ mensaje: 'Incidencia registrada', id: result.insertId, codigo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al guardar la incidencia' });
    }
});

router.put('/:id', verificarToken, upload.single('foto'), async (req, res) => {
    const { id_categoria, descripcion, latitud, longitud, titulo, direccion_referencia, id_zona } = req.body;
    try {
        const params = [id_categoria, titulo || null, descripcion, direccion_referencia || null,
            latitud, longitud, id_zona || null];
        let photoSql = '';
        if (req.file) { photoSql = ', foto_reporte=?'; params.push(req.file.filename); }
        params.push(req.params.id, req.usuario.id);
        const [result] = await sql.execute(
            `UPDATE incidencias SET id_categoria=?, titulo=?, descripcion=?, direccion_referencia=?,
             latitud=?, longitud=?, id_zona=?${photoSql}
             WHERE id_incidencia=? AND id_usuario=? AND id_estado=1 AND eliminado_en IS NULL`, params,
        );
        if (!result.affectedRows) return res.status(400).json({ error: 'Solo puedes editar reportes propios pendientes' });
        res.json({ mensaje: 'Reporte actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el reporte' });
    }
});

router.delete('/:id', verificarToken, async (req, res) => {
    try {
        const [result] = await sql.execute(
            `UPDATE incidencias SET id_estado=5, fecha_cierre=CURRENT_TIMESTAMP
             WHERE id_incidencia=? AND id_usuario=? AND id_estado=1 AND eliminado_en IS NULL`,
            [req.params.id, req.usuario.id],
        );
        if (!result.affectedRows) return res.status(400).json({ error: 'Solo puedes cancelar reportes propios pendientes' });
        res.json({ mensaje: 'Reporte cancelado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al cancelar el reporte' });
    }
});

router.post('/:id/comentarios', verificarToken, async (req, res) => {
    if (!req.body.comentario?.trim()) return res.status(400).json({ error: 'El comentario es obligatorio' });
    try {
        if (req.usuario.rol === 1) {
            const [owned] = await sql.execute('SELECT 1 FROM incidencias WHERE id_incidencia=? AND id_usuario=?', [req.params.id, req.usuario.id]);
            if (!owned.length) return res.status(403).json({ error: 'No puedes comentar reportes de otro ciudadano' });
        }
        await sql.execute(
            'INSERT INTO comentarios_incidencia (id_incidencia,id_usuario,comentario,es_interno) VALUES (?,?,?,?)',
            [req.params.id, req.usuario.id, req.body.comentario.trim(), req.usuario.rol === 1 ? false : Boolean(req.body.es_interno)],
        );
        res.status(201).json({ mensaje: 'Comentario agregado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al agregar comentario' });
    }
});

module.exports = router;
