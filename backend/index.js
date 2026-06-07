const express = require('express');
const cors = require('cors');

// Inicializar la aplicación
const app = express();

// Middlewares básicos
app.use(cors()); // Permite peticiones desde el frontend
app.use(express.json()); // Permite recibir datos en formato JSON

// Puerto donde correrá el servidor
const PORT = process.env.PORT || 3000;

// Ruta de prueba inicial
app.get('/', (req, res) => {
    res.send('¡Servidor de Llajta Inteligente corriendo al 100%!');
});

// Levantar el servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});