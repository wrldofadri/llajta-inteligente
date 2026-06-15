const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('./db');
const { verificarToken, verificarRol } = require('./middlewares/authMiddleware');

const router = express.Router();
const sql = db.promise();
const staff = [2, 3, 4];

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

router.use(verificarToken);

async function auditar(req, accion, entidad, entidadId, nuevos = null) {
    await sql.execute(
        `INSERT INTO auditoria (id_usuario,accion,entidad,entidad_id,datos_nuevos,ip_origen)
         VALUES (?,?,?,?,?,?)`,
        [req.usuario.id, accion, entidad, String(entidadId), nuevos ? JSON.stringify(nuevos) : null, req.ip],
    );
}

router.get('/resumen', verificarRol(staff), async (req, res) => {
    try {
        const operatorCondition = req.usuario.rol === 2
            ? ' AND EXISTS (SELECT 1 FROM asignaciones a WHERE a.id_incidencia=i.id_incidencia AND a.id_operador=? AND a.activa=TRUE)'
            : '';
        const params = req.usuario.rol === 2 ? [req.usuario.id] : [];
        const [[totales], [categorias], [ultimas], [heatmap]] = await Promise.all([
            sql.execute(`SELECT COUNT(*) total,
                SUM(i.id_estado=1) pendientes, SUM(i.id_estado=2) en_proceso,
                SUM(i.id_estado=6) por_validar, SUM(i.id_estado=3) resueltas,
                SUM(p.nivel>=3 AND i.id_estado NOT IN (3,4,5)) urgentes,
                ROUND(AVG(CASE WHEN i.fecha_resolucion IS NOT NULL THEN TIMESTAMPDIFF(HOUR,i.fecha_reporte,i.fecha_resolucion) END),1) promedio_horas
                FROM incidencias i JOIN prioridades p ON p.id_prioridad=i.id_prioridad
                WHERE i.eliminado_en IS NULL${operatorCondition}`, params),
            sql.execute(`SELECT c.nombre, c.color, COUNT(i.id_incidencia) total
                FROM categorias c LEFT JOIN incidencias i ON i.id_categoria=c.id_categoria AND i.eliminado_en IS NULL
                GROUP BY c.id_categoria,c.nombre,c.color ORDER BY total DESC`),
            sql.execute(`SELECT i.id_incidencia,i.codigo,i.descripcion,i.fecha_reporte,i.id_estado,
                c.nombre categoria_nombre,e.nombre estado_nombre,p.nombre prioridad_nombre,p.nivel prioridad_nivel
                FROM incidencias i JOIN categorias c ON c.id_categoria=i.id_categoria
                JOIN estados e ON e.id_estado=i.id_estado JOIN prioridades p ON p.id_prioridad=i.id_prioridad
                WHERE i.eliminado_en IS NULL${operatorCondition} ORDER BY i.fecha_reporte DESC LIMIT 8`, params),
            sql.query('SELECT * FROM vw_mapa_calor ORDER BY intensidad DESC LIMIT 100'),
        ]);
        res.json({ totales: totales[0], categorias, ultimas, heatmap });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar indicadores' });
    }
});

router.get('/incidencias', verificarRol(staff), async (req, res) => {
    try {
        const conditions = ['i.eliminado_en IS NULL'];
        const params = [];
        if (req.usuario.rol === 2) {
            conditions.push('EXISTS (SELECT 1 FROM asignaciones ax WHERE ax.id_incidencia=i.id_incidencia AND ax.id_operador=? AND ax.activa=TRUE)');
            params.push(req.usuario.id);
        }
        for (const [queryKey, column] of [['estado','i.id_estado'],['categoria','i.id_categoria'],['prioridad','i.id_prioridad']]) {
            if (req.query[queryKey]) { conditions.push(`${column}=?`); params.push(req.query[queryKey]); }
        }
        if (req.query.buscar) {
            conditions.push('(i.codigo LIKE ? OR i.descripcion LIKE ? OR u.nombre_completo LIKE ?)');
            const value = `%${req.query.buscar}%`; params.push(value, value, value);
        }
        const [rows] = await sql.execute(
            `SELECT i.*,u.nombre_completo ciudadano,c.nombre categoria_nombre,c.color categoria_color,
                    e.nombre estado_nombre,e.color estado_color,p.nombre prioridad_nombre,p.nivel prioridad_nivel,
                    z.nombre zona_nombre,a.id_asignacion,a.id_operador,a.id_cuadrilla,
                    op.nombre_completo operador,q.nombre cuadrilla
             FROM incidencias i JOIN usuarios u ON u.id_usuario=i.id_usuario
             JOIN categorias c ON c.id_categoria=i.id_categoria JOIN estados e ON e.id_estado=i.id_estado
             JOIN prioridades p ON p.id_prioridad=i.id_prioridad LEFT JOIN zonas z ON z.id_zona=i.id_zona
             LEFT JOIN asignaciones a ON a.id_incidencia=i.id_incidencia AND a.activa=TRUE
             LEFT JOIN usuarios op ON op.id_usuario=a.id_operador LEFT JOIN cuadrillas q ON q.id_cuadrilla=a.id_cuadrilla
             WHERE ${conditions.join(' AND ')} ORDER BY p.nivel DESC,i.fecha_reporte DESC`, params,
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar incidencias' });
    }
});

router.patch('/incidencias/:id/prioridad', verificarRol([3,4]), async (req, res) => {
    try {
        await sql.execute('UPDATE incidencias SET id_prioridad=? WHERE id_incidencia=?', [req.body.id_prioridad, req.params.id]);
        await auditar(req, 'CAMBIAR_PRIORIDAD', 'incidencias', req.params.id, req.body);
        res.json({ mensaje: 'Prioridad actualizada' });
    } catch (error) { res.status(500).json({ error: 'Error al actualizar prioridad' }); }
});

router.post('/incidencias/:id/asignar', verificarRol([3,4]), async (req, res) => {
    const { id_operador, id_cuadrilla, instrucciones } = req.body;
    if (!id_operador && !id_cuadrilla) return res.status(400).json({ error: 'Selecciona operador o cuadrilla' });
    const connection = await sql.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute('UPDATE asignaciones SET activa=FALSE,motivo_reasignacion=? WHERE id_incidencia=? AND activa=TRUE', ['Reasignacion', req.params.id]);
        await connection.execute(
            `INSERT INTO asignaciones (id_incidencia,id_cuadrilla,id_operador,asignado_por,instrucciones)
             VALUES (?,?,?,?,?)`, [req.params.id, id_cuadrilla || null, id_operador || null, req.usuario.id, instrucciones || null],
        );
        await connection.execute('UPDATE incidencias SET fecha_asignacion=CURRENT_TIMESTAMP WHERE id_incidencia=?', [req.params.id]);
        if (id_operador) {
            await connection.execute(
                `INSERT INTO notificaciones (id_usuario,id_incidencia,tipo,titulo,mensaje)
                 VALUES (?,?,'asignacion','Nueva incidencia asignada','Tienes una nueva tarea municipal asignada')`,
                [id_operador, req.params.id],
            );
        }
        await connection.commit();
        await auditar(req, 'ASIGNAR', 'incidencias', req.params.id, req.body);
        res.status(201).json({ mensaje: 'Incidencia asignada' });
    } catch (error) {
        await connection.rollback(); console.error(error); res.status(500).json({ error: 'Error al asignar incidencia' });
    } finally { connection.release(); }
});

router.patch('/incidencias/:id/estado', verificarRol(staff), upload.single('evidencia'), async (req, res) => {
    const requested = Number(req.body.id_estado);
    try {
        const [[incidencia]] = await sql.execute('SELECT * FROM incidencias WHERE id_incidencia=?', [req.params.id]);
        if (!incidencia) return res.status(404).json({ error: 'Incidencia no encontrada' });
        if (req.usuario.rol === 2) {
            const [assignments] = await sql.execute('SELECT 1 FROM asignaciones WHERE id_incidencia=? AND id_operador=? AND activa=TRUE', [req.params.id, req.usuario.id]);
            if (!assignments.length) return res.status(403).json({ error: 'La incidencia no esta asignada a este operador' });
            if (![2, 6].includes(requested)) return res.status(403).json({ error: 'El operador solo puede iniciar o enviar a validacion' });
            if (requested === 6 && !req.file) return res.status(400).json({ error: 'La evidencia final es obligatoria' });
        }

        await sql.execute('UPDATE incidencias SET id_estado=? WHERE id_incidencia=?', [requested, req.params.id]);
        await sql.execute(
            'UPDATE historial_estados SET cambiado_por=?,observacion=? WHERE id_incidencia=? ORDER BY id_historial DESC LIMIT 1',
            [req.usuario.id, req.body.observacion || 'Cambio de estado', req.params.id],
        );
        if (req.file) {
            await sql.execute(
                `INSERT INTO incidencia_archivos
                 (id_incidencia,id_usuario,tipo,nombre_archivo,ruta_archivo,mime_type,tamano_bytes,descripcion)
                 VALUES (?,?, 'resolucion',?,?,?,?,?)`,
                [req.params.id, req.usuario.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.body.observacion || 'Evidencia del trabajo'],
            );
        }
        await sql.execute(
            `INSERT INTO notificaciones (id_usuario,id_incidencia,tipo,titulo,mensaje)
             VALUES (?,?,'estado','Actualizacion de tu reporte',?)`,
            [incidencia.id_usuario, req.params.id, `El estado de tu reporte cambio a ${requested}`],
        );
        await auditar(req, 'CAMBIAR_ESTADO', 'incidencias', req.params.id, { id_estado: requested });
        res.json({ mensaje: 'Estado actualizado' });
    } catch (error) { console.error(error); res.status(500).json({ error: 'Error al actualizar estado' }); }
});

router.post('/incidencias/:id/validar', verificarRol([3,4]), async (req, res) => {
    const { resultado, observaciones } = req.body;
    if (!['aprobado','observado','rechazado'].includes(resultado)) return res.status(400).json({ error: 'Resultado invalido' });
    const estado = resultado === 'aprobado' ? 3 : resultado === 'observado' ? 2 : 4;
    const connection = await sql.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute(
            'INSERT INTO validaciones_supervisor (id_incidencia,id_supervisor,resultado,observaciones) VALUES (?,?,?,?)',
            [req.params.id, req.usuario.id, resultado, observaciones || null],
        );
        await connection.execute('UPDATE incidencias SET id_estado=? WHERE id_incidencia=?', [estado, req.params.id]);
        if (resultado === 'aprobado') await connection.execute('UPDATE asignaciones SET activa=FALSE,fecha_finalizacion=CURRENT_TIMESTAMP WHERE id_incidencia=? AND activa=TRUE', [req.params.id]);
        await connection.commit();
        await auditar(req, 'VALIDAR_TRABAJO', 'incidencias', req.params.id, req.body);
        res.json({ mensaje: 'Validacion registrada' });
    } catch (error) { await connection.rollback(); res.status(500).json({ error: 'Error al validar trabajo' }); }
    finally { connection.release(); }
});

router.get('/usuarios', verificarRol([3]), async (req, res) => {
    const [rows] = await sql.query(`SELECT u.id_usuario,u.nombre_completo,u.correo,u.telefono,u.activo,u.ultimo_acceso,
        u.id_rol,r.nombre rol_nombre FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol ORDER BY u.creado_en DESC`);
    res.json(rows);
});

router.post('/usuarios', verificarRol([3]), async (req, res) => {
    const { nombre_completo, correo, contrasena, id_rol, telefono } = req.body;
    if (!nombre_completo || !correo || !contrasena || !id_rol || contrasena.length < 10) return res.status(400).json({ error: 'Datos incompletos o contrasena muy corta' });
    try {
        const hash = await bcrypt.hash(contrasena, 12);
        const [result] = await sql.execute(
            'INSERT INTO usuarios (nombre_completo,correo,contrasena,id_rol,telefono,correo_verificado) VALUES (?,?,?,?,?,TRUE)',
            [nombre_completo.trim(), correo.trim().toLowerCase(), hash, id_rol, telefono || null],
        );
        await auditar(req, 'CREAR_USUARIO', 'usuarios', result.insertId, { correo, id_rol });
        res.status(201).json({ mensaje: 'Usuario creado', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El correo ya existe' });
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

router.patch('/usuarios/:id', verificarRol([3]), async (req, res) => {
    const fields = []; const params = [];
    if (req.body.id_rol) { fields.push('id_rol=?'); params.push(req.body.id_rol); }
    if (typeof req.body.activo === 'boolean') { fields.push('activo=?'); params.push(req.body.activo); }
    if (!fields.length) return res.status(400).json({ error: 'No hay cambios' });
    params.push(req.params.id);
    await sql.execute(`UPDATE usuarios SET ${fields.join(',')} WHERE id_usuario=?`, params);
    await auditar(req, 'ACTUALIZAR_USUARIO', 'usuarios', req.params.id, req.body);
    res.json({ mensaje: 'Usuario actualizado' });
});

router.get('/cuadrillas', verificarRol(staff), async (req, res) => {
    const [rows] = await sql.query(`SELECT q.*,c.nombre categoria_nombre,COUNT(cm.id_usuario) miembros
        FROM cuadrillas q JOIN categorias c ON c.id_categoria=q.id_categoria
        LEFT JOIN cuadrilla_miembros cm ON cm.id_cuadrilla=q.id_cuadrilla AND cm.retirado_en IS NULL
        WHERE q.activo=TRUE GROUP BY q.id_cuadrilla ORDER BY q.nombre`);
    const [operadores] = await sql.query('SELECT id_usuario,nombre_completo,correo FROM usuarios WHERE id_rol=2 AND activo=TRUE ORDER BY nombre_completo');
    res.json({ cuadrillas: rows, operadores });
});

router.post('/cuadrillas', verificarRol([3]), async (req, res) => {
    const [result] = await sql.execute(
        'INSERT INTO cuadrillas (id_categoria,nombre,descripcion,telefono_contacto) VALUES (?,?,?,?)',
        [req.body.id_categoria, req.body.nombre, req.body.descripcion || null, req.body.telefono_contacto || null],
    );
    res.status(201).json({ mensaje: 'Cuadrilla creada', id: result.insertId });
});

router.post('/cuadrillas/:id/miembros', verificarRol([3]), async (req, res) => {
    await sql.execute(
        `INSERT INTO cuadrilla_miembros (id_cuadrilla,id_usuario,es_responsable) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE retirado_en=NULL,es_responsable=?`,
        [req.params.id, req.body.id_usuario, Boolean(req.body.es_responsable), Boolean(req.body.es_responsable)],
    );
    res.status(201).json({ mensaje: 'Miembro asignado' });
});

router.patch('/categorias/:id', verificarRol([3]), async (req, res) => {
    const { nombre, descripcion, area_responsable, activo } = req.body;
    await sql.execute(
        `UPDATE categorias SET nombre=COALESCE(?,nombre),descripcion=COALESCE(?,descripcion),
         area_responsable=COALESCE(?,area_responsable),activo=COALESCE(?,activo) WHERE id_categoria=?`,
        [nombre || null, descripcion || null, area_responsable || null, typeof activo === 'boolean' ? activo : null, req.params.id],
    );
    await auditar(req, 'ACTUALIZAR_CATEGORIA', 'categorias', req.params.id, req.body);
    res.json({ mensaje: 'Categoria actualizada' });
});

router.patch('/prioridades/:id', verificarRol([3]), async (req, res) => {
    const { horas_primera_respuesta, horas_resolucion, descripcion } = req.body;
    await sql.execute(
        `UPDATE prioridades SET horas_primera_respuesta=COALESCE(?,horas_primera_respuesta),
         horas_resolucion=COALESCE(?,horas_resolucion),descripcion=COALESCE(?,descripcion) WHERE id_prioridad=?`,
        [horas_primera_respuesta || null, horas_resolucion || null, descripcion || null, req.params.id],
    );
    await auditar(req, 'ACTUALIZAR_SLA', 'prioridades', req.params.id, req.body);
    res.json({ mensaje: 'SLA actualizado' });
});

router.get('/notificaciones', async (req, res) => {
    const [rows] = await sql.execute('SELECT * FROM notificaciones WHERE id_usuario=? ORDER BY creado_en DESC LIMIT 30', [req.usuario.id]);
    res.json(rows);
});

router.patch('/notificaciones/:id/leer', async (req, res) => {
    await sql.execute('UPDATE notificaciones SET leida_en=CURRENT_TIMESTAMP WHERE id_notificacion=? AND id_usuario=?', [req.params.id, req.usuario.id]);
    res.json({ mensaje: 'Notificacion leida' });
});

router.get('/reportes/pdf', verificarRol([3,4]), async (req, res) => {
    const [rows] = await sql.query(`SELECT i.codigo,c.nombre categoria,e.nombre estado,p.nombre prioridad,
        u.nombre_completo ciudadano,i.descripcion,i.fecha_reporte,i.fecha_resolucion
        FROM incidencias i JOIN categorias c ON c.id_categoria=i.id_categoria
        JOIN estados e ON e.id_estado=i.id_estado JOIN prioridades p ON p.id_prioridad=i.id_prioridad
        JOIN usuarios u ON u.id_usuario=i.id_usuario WHERE i.eliminado_en IS NULL ORDER BY i.fecha_reporte DESC`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-incidencias-${new Date().toISOString().slice(0,10)}.pdf"`);
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    doc.pipe(res);
    doc.fontSize(22).fillColor('#0F172A').text('Llajta Inteligente');
    doc.fontSize(12).fillColor('#475569').text('Reporte consolidado de incidencias urbanas');
    doc.moveDown().fontSize(10).text(`Generado: ${new Date().toLocaleString('es-BO')}`);
    doc.moveDown();
    rows.forEach((row, index) => {
        if (doc.y > 740) doc.addPage();
        doc.fontSize(11).fillColor('#0F172A').text(`${index + 1}. ${row.codigo || 'Sin codigo'} | ${row.categoria} | ${row.estado}`);
        doc.fontSize(9).fillColor('#475569').text(`${row.prioridad} - ${row.ciudadano} - ${new Date(row.fecha_reporte).toLocaleDateString('es-BO')}`);
        doc.text(row.descripcion, { width: 500 }).moveDown(0.6);
    });
    doc.end();
});

module.exports = router;
