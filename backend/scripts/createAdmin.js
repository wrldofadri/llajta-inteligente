const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const requiredVariables = [
    'DB_HOST',
    'DB_USER',
    'DB_NAME',
    'ADMIN_NAME',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
];

const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
    console.error(`Faltan variables en backend/.env: ${missingVariables.join(', ')}`);
    process.exit(1);
}

if (process.env.ADMIN_PASSWORD.length < 12) {
    console.error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
    process.exit(1);
}

async function createAdmin() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
        charset: 'utf8mb4',
    });

    try {
        const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
        const [existingUsers] = await connection.execute(
            'SELECT id_usuario FROM usuarios WHERE correo = ? LIMIT 1',
            [email],
        );

        if (existingUsers.length > 0) {
            throw new Error(`Ya existe un usuario con el correo ${email}.`);
        }

        const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

        const [result] = await connection.execute(
            `INSERT INTO usuarios
                (id_rol, nombre_completo, correo, contrasena, activo, correo_verificado)
             VALUES (3, ?, ?, ?, TRUE, TRUE)`,
            [process.env.ADMIN_NAME.trim(), email, passwordHash],
        );

        console.log(`Administrador creado correctamente con ID ${result.insertId}.`);
    } finally {
        await connection.end();
    }
}

createAdmin().catch((error) => {
    console.error(`No se pudo crear el administrador: ${error.message}`);
    process.exit(1);
});

