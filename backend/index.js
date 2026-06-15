const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const authRoutes = require('./auth');
const incidenciasRoutes = require('./incidencias');
const gestionRoutes = require('./gestion');

const app = express();
const uploadsDirectory = path.join(__dirname, 'uploads');
const PORT = Number(process.env.PORT || 3000);

fs.mkdirSync(uploadsDirectory, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDirectory));

app.use('/api/auth', authRoutes);
app.use('/api/incidencias', incidenciasRoutes);
app.use('/api/gestion', gestionRoutes);

app.get('/', (req, res) => {
    res.send('Servidor de Llajta Inteligente funcionando.');
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutandose en el puerto ${PORT}`);
});
