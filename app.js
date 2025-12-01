require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const mqttClient = require('./src/mqtt/mqttClient');
const mqttConfig = require('./src/mqtt/mqttConfig');

const areaRoutes = require('./src/routes/areaRoute');
const smartBinRoutes = require('./src/routes/smartBinRoutes');
const binRoutes = require('./src/routes/binRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());   
app.use(express.json());

app.use('/api/areas', areaRoutes);
app.use('/api/devices', smartBinRoutes);
app.use('/api/bins', binRoutes);

app.get('/', (req, res) => {
  res.json({ 
    message: 'API de Areas funcionando correctamente',
    mqtt_status: mqttClient.isConnected() ? '✅ Conectado' : '❌ Desconectado'
  });
});

app.get('/api/mqtt/messages', (req, res) => {
  res.json({
    connected: mqttClient.isConnected(),
    messages: mqttClient.getAllMessages()
  });
});

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

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB');
    
    console.log('\n🔌 Iniciando conexión MQTT...');
    
    mqttClient.connect(
      mqttConfig.brokerUrl,
      mqttConfig.options,
      mqttConfig.topics
    );

    mqttClient.registerHandler('/test/comment', (payload, topic) => {
      console.log('💬 Comentario recibido:', payload);
    });

    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📡 Estado MQTT: ${mqttClient.isConnected() ? 'Conectado' : 'Esperando conexión...'}`);
    });

    const gracefulShutdown = () => {
      console.log('\n👋 Cerrando aplicación...');
      
      mqttClient.disconnect();
      
      server.close(() => {
        console.log('✅ Servidor HTTP cerrado');
        
        mongoose.connection.close(false, () => {
          console.log('✅ Conexión MongoDB cerrada');
          console.log('✅ Aplicación cerrada correctamente');
          process.exit(0);
        });
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
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