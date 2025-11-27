// src/app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 

const areaRoutes = require('./src/routes/areaRoute');
const smartBinRoutes = require('./src/routes/smartBinRoutes');
const binRoutes = require('./src/routes/binRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());   
app.use(express.json());


// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Rutas
app.use('/api/areas', areaRoutes);
app.use('/api/devices', smartBinRoutes);
app.use('/api/bins', binRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API de Areas funcionando correctamente' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Algo salió mal!',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});