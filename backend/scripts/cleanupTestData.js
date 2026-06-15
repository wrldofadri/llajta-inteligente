const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME,
    });
    const [users] = await connection.query("SELECT id_usuario FROM usuarios WHERE correo LIKE 'prueba.%@llajta.bo'");
    for (const user of users) {
        const [incidents] = await connection.execute('SELECT id_incidencia FROM incidencias WHERE id_usuario=?', [user.id_usuario]);
        for (const incident of incidents) {
            for (const table of ['notificaciones','validaciones_supervisor','comentarios_incidencia','historial_estados','incidencia_archivos','asignaciones']) {
                await connection.execute(`DELETE FROM ${table} WHERE id_incidencia=?`, [incident.id_incidencia]);
            }
            await connection.execute('DELETE FROM incidencias WHERE id_incidencia=?', [incident.id_incidencia]);
        }
        await connection.execute('DELETE FROM usuarios WHERE id_usuario=?', [user.id_usuario]);
    }
    const [[remainingUsers]] = await connection.query("SELECT COUNT(*) total FROM usuarios WHERE correo LIKE 'prueba.%@llajta.bo'");
    const [[remainingIncidents]] = await connection.query('SELECT COUNT(*) total FROM incidencias');
    console.log(`Usuarios de prueba: ${remainingUsers.total}; incidencias: ${remainingIncidents.total}`);
    await connection.end();
}

main().catch((error) => { console.error(error.message); process.exit(1); });
