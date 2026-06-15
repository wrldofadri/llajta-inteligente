const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { verificarToken } = require('./middlewares/authMiddleware');

const router = express.Router();
const sql = db.promise();
const SECRET_KEY = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = 12;

if (!SECRET_KEY || SECRET_KEY.length < 32) {
    throw new Error('JWT_SECRET debe existir y tener al menos 32 caracteres');
}

router.post('/registro', async (req, res) => {
    const { nombre_completo, correo, contrasena, telefono } = req.body;

    if (!nombre_completo?.trim() || !correo?.trim() || !contrasena) {
        return res.status(400).json({ error: 'Nombre, correo y contrasena son obligatorios' });
    }
    if (contrasena.length < 10) {
        return res.status(400).json({ error: 'La contrasena debe tener al menos 10 caracteres' });
    }

    try {
        const hash = await bcrypt.hash(contrasena, BCRYPT_ROUNDS);
        await sql.execute(
            `INSERT INTO usuarios (id_rol, nombre_completo, correo, contrasena, telefono)
             VALUES (1, ?, ?, ?, ?)`,
            [nombre_completo.trim(), correo.trim().toLowerCase(), hash, telefono?.trim() || null],
        );
        res.status(201).json({ mensaje: 'Usuario registrado con exito' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El correo ya esta registrado' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

router.post('/login', async (req, res) => {
    const { correo, contrasena } = req.body;
    if (!correo?.trim() || !contrasena) {
        return res.status(400).json({ error: 'Correo y contrasena son obligatorios' });
    }

    try {
        const [usuarios] = await sql.execute(
            `SELECT u.*, r.nombre AS rol_nombre
             FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.correo = ? AND u.activo = TRUE LIMIT 1`,
            [correo.trim().toLowerCase()],
        );
        if (!usuarios.length || !(await bcrypt.compare(contrasena, usuarios[0].contrasena))) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const usuario = usuarios[0];
        const token = jwt.sign({ id: usuario.id_usuario, rol: usuario.id_rol }, SECRET_KEY, { expiresIn: '8h' });
        await sql.execute('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = ?', [usuario.id_usuario]);

        res.json({
            mensaje: 'Login exitoso',
            token,
            usuario: {
                id: usuario.id_usuario,
                nombre: usuario.nombre_completo,
                correo: usuario.correo,
                rol: usuario.id_rol,
                rol_nombre: usuario.rol_nombre,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al iniciar sesion' });
    }
});

router.get('/me', verificarToken, async (req, res) => {
    try {
        const [rows] = await sql.execute(
            `SELECT u.id_usuario AS id, u.nombre_completo AS nombre, u.correo, u.telefono,
                    u.id_rol AS rol, r.nombre AS rol_nombre
             FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.id_usuario = ? AND u.activo = TRUE`,
            [req.usuario.id],
        );
        if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar la sesion' });
    }
});

module.exports = router;
