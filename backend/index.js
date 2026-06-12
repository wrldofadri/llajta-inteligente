const express = require('express');
const cors = require('cors');
const path = require('path'); // <-- Agregado para manejar rutas de archivos de forma segura
const authRoutes = require('./auth'); 
const incidenciasRoutes = require('./incidencias'); // <-- Importamos la nueva ruta de reportes

const app = express();

app.use(cors());
app.use(express.json());

// Servir la carpeta uploads como estática para que se puedan ver las fotos desde el navegador/frontend
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Registrar las rutas del sistema
app.use('/api/auth', authRoutes);
app.use('/api/incidencias', incidenciasRoutes); // <-- Conectamos las incidencias al servidor

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('¡Servidor de Llajta Inteligente corriendo al 100%!');
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});