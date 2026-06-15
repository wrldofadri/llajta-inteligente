const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function updatePasswords() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
        charset: 'utf8mb4',
    });

    try {
        const passwordHash = await bcrypt.hash('contra12345', 12);

        const [result] = await connection.execute(
            `UPDATE usuarios SET contrasena = ? WHERE correo IN ('admin@llajta.bo', 'operador@llajta.bo', 'supervisor@llajta.bo')`,
            [passwordHash],
        );

        console.log(`Contraseñas actualizadas correctamente. Filas afectadas: ${result.affectedRows}`);
    } finally {
        await connection.end();
    }
}

updatePasswords().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
});
