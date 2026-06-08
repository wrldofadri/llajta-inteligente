const express = require('express');
const cors = require('cors');
const authRoutes = require('./auth'); // Importamos nuestras rutas

const app = express();

app.use(cors());
app.use(express.json());

// Usar las rutas de autenticación
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('¡Servidor de Llajta Inteligente corriendo al 100%!');
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});