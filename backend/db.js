const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'Wrld-Of-Santy',
    user: 'root', 
    password: 'Visa9265109', 
    database: 'llajta_inteligente'
});

db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        return;
    }
    console.log('¡Conectado a MySQL exitosamente!');
});

module.exports = db;