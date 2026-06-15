const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const base = 'http://localhost:3000/api';

async function request(url, options = {}) {
    const response = await fetch(`${base}${url}`, options);
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.arrayBuffer();
    if (!response.ok) throw new Error(`${response.status} ${url}: ${JSON.stringify(data)}`);
    return data;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function login(correo, contrasena) {
    return request('/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contrasena }),
    });
}

async function cleanup(email) {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME,
    });
    const [[user]] = await connection.execute('SELECT id_usuario FROM usuarios WHERE correo=?', [email]);
    if (!user) return connection.end();
    const [incidents] = await connection.execute('SELECT id_incidencia FROM incidencias WHERE id_usuario=?', [user.id_usuario]);
    for (const { id_incidencia } of incidents) {
        for (const table of ['notificaciones','validaciones_supervisor','comentarios_incidencia','historial_estados','incidencia_archivos','asignaciones']) {
            await connection.execute(`DELETE FROM ${table} WHERE id_incidencia=?`, [id_incidencia]);
        }
        await connection.execute('DELETE FROM incidencias WHERE id_incidencia=?', [id_incidencia]);
    }
    await connection.execute('DELETE FROM usuarios WHERE id_usuario=?', [user.id_usuario]);
    await connection.end();
}

async function main() {
    const suffix = Date.now();
    const citizenEmail = `prueba.${suffix}@llajta.bo`;
    await request('/auth/registro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_completo: 'Ciudadano de Prueba', correo: citizenEmail, contrasena: 'Ciudadano#2026!' }),
    });
    const citizen = await login(citizenEmail, 'Ciudadano#2026!');

    const imagePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'assets', 'Logo.png');
    const image = new Blob([fs.readFileSync(imagePath)], { type: 'image/png' });
    const report = new FormData();
    report.append('id_categoria', '2'); report.append('titulo', 'Bache peligroso de prueba');
    report.append('descripcion', 'Bache profundo que representa peligro para vehiculos y peatones.');
    report.append('latitud', '-17.3895'); report.append('longitud', '-66.1568'); report.append('foto', image, 'evidencia.png');
    const created = await request('/incidencias/registrar', { method: 'POST', headers: auth(citizen.token), body: report });

    const admin = await login('admin@llajta.bo', 'LlajtaAdmin#2026!');
    const users = await request('/gestion/usuarios', { headers: auth(admin.token) });
    const operator = users.find((user) => user.id_rol === 2);
    await request(`/gestion/incidencias/${created.id}/asignar`, {
        method: 'POST', headers: { ...auth(admin.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_operador: operator.id_usuario, instrucciones: 'Prueba integral' }),
    });

    const operatorLogin = await login('operador@llajta.bo', 'LlajtaOperador#2026!');
    const started = new FormData(); started.append('id_estado', '2'); started.append('observacion', 'Atencion iniciada');
    await request(`/gestion/incidencias/${created.id}/estado`, { method: 'PATCH', headers: auth(operatorLogin.token), body: started });
    const completed = new FormData(); completed.append('id_estado', '6'); completed.append('observacion', 'Bache reparado'); completed.append('evidencia', image, 'solucion.png');
    await request(`/gestion/incidencias/${created.id}/estado`, { method: 'PATCH', headers: auth(operatorLogin.token), body: completed });

    const supervisor = await login('supervisor@llajta.bo', 'LlajtaSupervisor#2026!');
    await request(`/gestion/incidencias/${created.id}/validar`, {
        method: 'POST', headers: { ...auth(supervisor.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado: 'aprobado', observaciones: 'Evidencia conforme' }),
    });

    const detail = await request(`/incidencias/${created.id}/detalle`, { headers: auth(citizen.token) });
    if (detail.incidencia.id_estado !== 3 || detail.archivos.length < 2 || detail.historial.length < 3) {
        throw new Error('El flujo no termino con evidencia e historial completos');
    }
    const pdf = await request('/gestion/reportes/pdf', { headers: auth(supervisor.token) });
    if (pdf.byteLength < 1000) throw new Error('El PDF generado esta vacio');

    console.log(JSON.stringify({
        ok: true, codigo: created.codigo, estado: detail.incidencia.estado_nombre,
        evidencias: detail.archivos.length, eventos: detail.historial.length, pdfBytes: pdf.byteLength,
    }, null, 2));
    await cleanup(citizenEmail);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
