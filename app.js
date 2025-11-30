// src/app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Importar cliente MQTT
const mqttClient = require('./src/mqtt/mqttClient');
const mqttConfig = require('./src/mqtt/mqttConfig');

// Importar rutas
const areaRoutes = require('./src/routes/areaRoute');
const smartBinRoutes = require('./src/routes/smartBinRoutes');
const binRoutes = require('./src/routes/binRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());   
app.use(express.json());

// Rutas principales
app.use('/api/areas', areaRoutes);
app.use('/api/devices', smartBinRoutes);
app.use('/api/bins', binRoutes);

app.get('/', (req, res) => {
  res.json({ 
    message: 'API de Areas funcionando correctamente',
    mqtt_status: mqttClient.isConnected() ? '✅ Conectado' : '❌ Desconectado'
  });
});

// Ruta para ver mensajes MQTT recientes
app.get('/api/mqtt/messages', (req, res) => {
  res.json({
    connected: mqttClient.isConnected(),
    messages: mqttClient.getAllMessages()
  });
});

// Ruta para publicar mensajes MQTT manualmente (útil para pruebas)
app.post('/api/mqtt/publish', (req, res) => {
  const { topic, message } = req.body;
  
  if (!topic || !message) {
    return res.status(400).json({ 
      error: 'Se requieren topic y message' 
    });
  }

  const success = mqttClient.publish(topic, message);
  
  res.json({
    success,
    topic,
    message: success ? 'Mensaje publicado correctamente' : 'Error al publicar'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Algo salió mal!',
    message: err.message
  });
});

// Conectar a MongoDB primero, luego a MQTT
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB');
    
    // ====== CONECTAR A MQTT DESPUÉS DE MONGODB ======
    console.log('\n🔌 Iniciando conexión MQTT...');
    
    mqttClient.connect(
      mqttConfig.brokerUrl,
      mqttConfig.options,
      mqttConfig.topics
    );

    // Opcional: Registrar handlers personalizados
    mqttClient.registerHandler('/test/comment', (payload, topic) => {
      console.log('💬 Comentario recibido:', payload);
      // Aquí puedes agregar lógica adicional
    });

    // Iniciar servidor HTTP
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📡 Estado MQTT: ${mqttClient.isConnected() ? 'Conectado' : 'Esperando conexión...'}`);
    });

    // ====== MANEJO DE CIERRE GRACEFUL ======
    const gracefulShutdown = () => {
      console.log('\n👋 Cerrando aplicación...');
      
      // Desconectar MQTT
      mqttClient.disconnect();
      
      // Cerrar servidor HTTP
      server.close(() => {
        console.log('✅ Servidor HTTP cerrado');
        
        // Cerrar conexión MongoDB
        mongoose.connection.close(false, () => {
          console.log('✅ Conexión MongoDB cerrada');
          console.log('✅ Aplicación cerrada correctamente');
          process.exit(0);
        });
      });
    };

    // Escuchar señales de cierre
    process.on('SIGINT', gracefulShutdown);  // Ctrl+C
    process.on('SIGTERM', gracefulShutdown); // Kill
  })
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err);
    process.exit(1);
  });

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});