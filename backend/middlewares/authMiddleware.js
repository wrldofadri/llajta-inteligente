const jwt = require('jsonwebtoken');
const SECRET_KEY = "mi_clave_secreta_super_segura"; // La misma que usaste en auth.js


const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'Se requiere un token de seguridad' });

    const tokenLimpio = token.split(' ')[1] || token;

    jwt.verify(tokenLimpio, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Token inválido o expirado' });
        req.usuario = decoded; // Guardamos los datos del usuario (id y rol)
        next();
    });
};

const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ error: 'Acceso denegado: No tienes el rol necesario' });
        }
        next();
    };
};

module.exports = { verificarToken, verificarRol };