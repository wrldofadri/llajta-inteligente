const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET;

if (!SECRET_KEY || SECRET_KEY.length < 32) {
    throw new Error('JWT_SECRET debe existir y tener al menos 32 caracteres');
}

const verificarToken = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(403).json({ error: 'Se requiere un token de seguridad' });
    }

    const [scheme, credentials] = authorization.split(' ');
    const token = scheme === 'Bearer' ? credentials : authorization;

    jwt.verify(token, SECRET_KEY, (error, decoded) => {
        if (error) {
            return res.status(401).json({ error: 'Token invalido o expirado' });
        }

        req.usuario = decoded;
        next();
    });
};

const verificarRol = (rolesPermitidos) => (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
        return res.status(403).json({ error: 'No tienes el rol necesario' });
    }

    next();
};

module.exports = { verificarToken, verificarRol };
