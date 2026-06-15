const path = require('path');
const mysql = require('mysql2');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
    throw new Error(`Faltan variables de base de datos: ${missingVariables.join(', ')}`);
}

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

db.getConnection((error, connection) => {
    if (error) {
        console.error('Error conectando a MySQL:', error.message);
        return;
    }

    console.log('Conectado a MySQL correctamente.');
    connection.release();
});

module.exports = db;
