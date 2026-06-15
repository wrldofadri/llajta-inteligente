const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function upsertUser(connection, { name, email, password, role }) {
    const hash = await bcrypt.hash(password, 12);
    await connection.execute(
        `INSERT INTO usuarios (id_rol,nombre_completo,correo,contrasena,activo,correo_verificado)
         VALUES (?,?,?,?,TRUE,TRUE)
         ON DUPLICATE KEY UPDATE id_rol=VALUES(id_rol),nombre_completo=VALUES(nombre_completo),activo=TRUE`,
        [role, name, email, hash],
    );
    const [[user]] = await connection.execute('SELECT id_usuario FROM usuarios WHERE correo=?', [email]);
    return user.id_usuario;
}

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
    });

    try {
        await connection.beginTransaction();
        await connection.execute(
            `INSERT INTO estados (id_estado,nombre,descripcion,color,es_final,orden_visual,activo)
             VALUES (6,'Pendiente de Validacion','Trabajo concluido por el operador y pendiente de revision','#7C3AED',FALSE,3,TRUE)
             ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),descripcion=VALUES(descripcion),color=VALUES(color),activo=TRUE`,
        );
        await connection.execute('UPDATE estados SET orden_visual=4 WHERE id_estado=3');
        await connection.execute('UPDATE estados SET orden_visual=5 WHERE id_estado=4');
        await connection.execute('UPDATE estados SET orden_visual=6 WHERE id_estado=5');

        const zones = [
            ['Centro','Distrito 10','Centro historico y comercial',-17.3935,-66.1570],
            ['Queru Queru','Distrito 12','Zona norte de Cochabamba',-17.3717,-66.1557],
            ['La Recoleta','Distrito 12','Corredor gastronomico y residencial',-17.3820,-66.1485],
            ['Temporal','Distrito 2','Zona noreste',-17.3555,-66.1390],
            ['Valle Hermoso','Distrito 8','Zona suroriental',-17.4250,-66.1330],
            ['Jaihuayco','Distrito 5','Zona sur',-17.4170,-66.1650],
            ['Sarco','Distrito 3','Zona occidental',-17.3850,-66.1900],
            ['Tiquipaya','Metropolitana','Area metropolitana noroeste',-17.3380,-66.2150],
        ];
        for (const zone of zones) {
            await connection.execute(
                `INSERT INTO zonas (nombre,distrito,descripcion,centro_latitud,centro_longitud)
                 VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion),centro_latitud=VALUES(centro_latitud),centro_longitud=VALUES(centro_longitud),activo=TRUE`, zone,
            );
        }

        const operatorId = await upsertUser(connection, {
            name: 'Operador Municipal', email: 'operador@llajta.bo', password: 'LlajtaOperador#2026!', role: 2,
        });
        await upsertUser(connection, {
            name: 'Supervisor Municipal', email: 'supervisor@llajta.bo', password: 'LlajtaSupervisor#2026!', role: 4,
        });

        const crews = [
            [1,'Cuadrilla de Limpieza Centro','Atencion de residuos y microbasurales'],
            [2,'Cuadrilla de Bacheo Urbano','Reparacion de calzadas y baches'],
            [3,'Equipo de Semaforizacion','Mantenimiento de semaforos y senalizacion'],
        ];
        for (const crew of crews) {
            await connection.execute(
                `INSERT INTO cuadrillas (id_categoria,nombre,descripcion) VALUES (?,?,?)
                 ON DUPLICATE KEY UPDATE id_categoria=VALUES(id_categoria),descripcion=VALUES(descripcion),activo=TRUE`, crew,
            );
        }
        const [[firstCrew]] = await connection.execute('SELECT id_cuadrilla FROM cuadrillas ORDER BY id_cuadrilla LIMIT 1');
        await connection.execute(
            `INSERT INTO cuadrilla_miembros (id_cuadrilla,id_usuario,es_responsable)
             VALUES (?,?,TRUE) ON DUPLICATE KEY UPDATE retirado_en=NULL,es_responsable=TRUE`,
            [firstCrew.id_cuadrilla, operatorId],
        );

        await connection.commit();
        console.log('Datos operativos creados correctamente.');
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
