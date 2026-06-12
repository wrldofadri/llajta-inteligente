const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('./db');
const { verificarToken } = require('./middlewares/authMiddleware');
console.log("Mi middleware es:", verificarToken);
const router = express.Router();

// Configurar Multer para guardar las fotos con un nombre único
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Asegúrate de que esta carpeta exista
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Ej: 16845345.jpg
    }
});
const upload = multer({ storage });

// POST: Registrar nueva incidencia (Protegido con Token)
router.post('/registrar', verificarToken, upload.single('foto'), (req, res) => {
    // req.usuario.id viene del token descifrado por el middleware
    const id_usuario = req.usuario.id; 
    const { id_categoria, descripcion, latitud, longitud } = req.body;
    
    // Asumimos que el ID 1 en tu tabla de estados es "Pendiente"
    const id_estado = 1; 
    const foto_reporte = req.file ? req.file.filename : null;

    if (!foto_reporte) {
        return res.status(400).json({ error: 'La foto es obligatoria para la evidencia' });
    }

    const query = `
        INSERT INTO incidencias 
        (id_usuario, id_categoria, id_estado, descripcion, latitud, longitud, foto_reporte) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

db.query(query, [id_usuario, id_categoria, id_estado, descripcion, latitud, longitud, foto_reporte], (err, result) => {
    if (err) {
        console.error("💥 ERROR MYSQL AL GUARDAR:", err); // <-- Esto hará que salga en la terminal
        return res.status(500).json({ error: 'Error al guardar en la base de datos', detalle: err });
    }
    res.status(201).json({ mensaje: '¡Incidencia reportada con éxito!' });
});
});
// GET: Obtener todas las incidencias para mostrarlas en el mapa
// GET: Obtener todas las incidencias para mostrarlas en el mapa
router.get('/todas', verificarToken, (req, res) => {
    const query = `
        SELECT i.*, u.nombre_completo AS ciudadano 
        FROM incidencias i
        JOIN usuarios u ON i.id_usuario = u.id_usuario 
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("💥 ERROR AL OBTENER REPORTES:", err);
            return res.status(500).json({ error: 'Error al obtener incidencias', detalle: err });
        }
        res.status(200).json(results);
    });
});
// GET: Obtener solo los reportes del usuario actual (Para la barra lateral)
router.get('/mis-reportes', verificarToken, (req, res) => {
    const id_usuario = req.usuario.id; 
    const query = `
        SELECT i.*, c.nombre AS categoria_nombre, e.nombre AS estado_nombre
        FROM incidencias i
        JOIN categorias c ON i.id_categoria = c.id_categoria
        JOIN estados e ON i.id_estado = e.id_estado
        WHERE i.id_usuario = ?
        ORDER BY i.fecha_reporte DESC
    `;

    db.query(query, [id_usuario], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener tus reportes', detalle: err });
        res.status(200).json(results);
    });
});

// DELETE: Cancelar/Borrar una incidencia
router.delete('/:id', verificarToken, (req, res) => {
    const id_incidencia = req.params.id;
    const id_usuario = req.usuario.id;
    
    // Medida de seguridad: Solo permite borrar si la creaste tú, y si sigue en estado 1 (Pendiente)
    const query = 'DELETE FROM incidencias WHERE id_incidencia = ? AND id_usuario = ? AND id_estado = 1';
    
    db.query(query, [id_incidencia, id_usuario], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error al cancelar', detalle: err });
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'No se puede cancelar. O no es tuyo, o ya está en proceso.' });
        }
        res.status(200).json({ mensaje: 'Reporte cancelado exitosamente' });
    });
});
// PUT: Editar un reporte (Solo permite editar si está en estado 1 - Pendiente)
router.put('/:id', verificarToken, upload.single('foto'), (req, res) => {
    const id_incidencia = req.params.id;
    const id_usuario = req.usuario.id;
    const { id_categoria, descripcion, latitud, longitud } = req.body;
    
    let query, params;

    // Si el usuario subió una foto nueva, actualizamos todo
    if (req.file) {
        query = 'UPDATE incidencias SET id_categoria=?, descripcion=?, latitud=?, longitud=?, foto_reporte=? WHERE id_incidencia=? AND id_usuario=? AND id_estado=1';
        params = [id_categoria, descripcion, latitud, longitud, req.file.filename, id_incidencia, id_usuario];
    } else {
        // Si no subió foto, actualizamos todo menos la foto
        query = 'UPDATE incidencias SET id_categoria=?, descripcion=?, latitud=?, longitud=? WHERE id_incidencia=? AND id_usuario=? AND id_estado=1';
        params = [id_categoria, descripcion, latitud, longitud, id_incidencia, id_usuario];
    }

    db.query(query, params, (err, result) => {
        if (err) return res.status(500).json({ error: 'Error al actualizar', detalle: err });
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'No se puede editar. O no es tuyo, o ya está en proceso.' });
        }
        res.status(200).json({ mensaje: '¡Reporte actualizado exitosamente!' });
    });
});

module.exports = router;