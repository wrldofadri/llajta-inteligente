const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');

const router = express.Router();
const SECRET_KEY = "mi_clave_secreta_super_segura"; // En un proyecto real esto va en un archivo .env

// --- RUTA DE REGISTRO ---
router.post('/registro', async (req, res) => {
    const { nombre_completo, correo, contrasena, id_rol } = req.body;

    try {
        // 1. Encriptar la contraseña
        const hashedPassword = await bcrypt.hash(contrasena, 10);

        // 2. Guardar en la base de datos
        const query = 'INSERT INTO usuarios (nombre_completo, correo, contrasena, id_rol) VALUES (?, ?, ?, ?)';
        db.query(query, [nombre_completo, correo, hashedPassword, id_rol], (err, result) => {
            if (err) return res.status(500).json({ error: 'Error al registrar usuario', detalle: err });
            res.status(201).json({ mensaje: 'Usuario registrado con éxito' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// --- RUTA DE LOGIN ---
router.post('/login', (req, res) => {
    const { correo, contrasena } = req.body;

    const query = 'SELECT * FROM usuarios WHERE correo = ?';
    db.query(query, [correo], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en la base de datos' });
        
        if (results.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const usuario = results[0];

        // Comparar contraseña encriptada
        const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!contrasenaValida) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        // Generar Token de sesión
        const token = jwt.sign({ id: usuario.id_usuario, rol: usuario.id_rol }, SECRET_KEY, { expiresIn: '2h' });

        res.json({ mensaje: 'Login exitoso', token, usuario: { nombre: usuario.nombre_completo, rol: usuario.id_rol } });
    });
});

module.exports = router;