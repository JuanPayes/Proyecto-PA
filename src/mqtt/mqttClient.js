// src/mqtt/MqttClient.js
const mqtt = require('mqtt');
const binController = require('../controllers/binController');
const deviceController = require('../controllers/deviceController');

class MqttClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.messages = {}; // Almacenar últimos mensajes por topic
    this.messageHandlers = {}; // Handlers personalizados por topic
  }

  /**
   * Conectar al broker MQTT
   * @param {string} brokerUrl - URL del broker (ejemplo: "mqtt://10.12.252.56:1883")
   * @param {object} options - Opciones de conexión (username, password, etc.)
   * @param {array} topics - Array de topics a suscribirse
   */
  connect(brokerUrl, options = {}, topics = []) {
    if (this.client) {
      console.log('⚠️  Cliente MQTT ya está conectado');
      return;
    }

    // Configuración por defecto
    const defaultOptions = {
      clientId: `backend_${Math.random().toString(16).substr(2, 8)}`,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      ...options
    };

    console.log(`🔌 Conectando a MQTT Broker: ${brokerUrl}...`);
    
    this.client = mqtt.connect(brokerUrl, defaultOptions);

    // Evento: Conexión exitosa
    this.client.on('connect', () => {
      this.connected = true;
      console.log('✅ Conectado al broker MQTT');
      console.log(`📋 Cliente ID: ${defaultOptions.clientId}`);

      // Suscribirse a los topics
      if (topics && topics.length > 0) {
        this.subscribe(topics);
      }

      // Iniciar chequeo de devices offline
      this.startOfflineCheck();
    });

    // Evento: Mensaje recibido
    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });

    // Evento: Error
    this.client.on('error', (error) => {
      console.error('❌ Error MQTT:', error.message);
    });

    // Evento: Reconexión
    this.client.on('reconnect', () => {
      console.log('🔄 Reconectando al broker MQTT...');
    });

    // Evento: Desconexión
    this.client.on('close', () => {
      this.connected = false;
      console.log('⚠️  Desconectado del broker MQTT');
    });

    // Evento: Offline
    this.client.on('offline', () => {
      this.connected = false;
      console.log('📴 Cliente MQTT offline');
    });
  }

  /**
   * Suscribirse a topics
   * @param {array|string} topics - Topic o array de topics
   */
  subscribe(topics) {
    if (!this.client) {
      console.error('❌ Cliente MQTT no está conectado');
      return;
    }

    const topicList = Array.isArray(topics) ? topics : [topics];

    this.client.subscribe(topicList, (err) => {
      if (err) {
        console.error('❌ Error al suscribirse:', err);
      } else {
        console.log(`📡 Suscrito a ${topicList.length} topic(s):`);
        topicList.forEach(topic => console.log(`   - ${topic}`));
      }
    });
  }

  /**
   * Desuscribirse de topics
   * @param {array|string} topics - Topic o array de topics
   */
  unsubscribe(topics) {
    if (!this.client) return;

    const topicList = Array.isArray(topics) ? topics : [topics];
    
    this.client.unsubscribe(topicList, (err) => {
      if (err) {
        console.error('❌ Error al desuscribirse:', err);
      } else {
        console.log(`📴 Desuscrito de: ${topicList.join(', ')}`);
      }
    });
  }

  /**
   * Publicar mensaje a un topic
   * @param {string} topic - Topic de destino
   * @param {string|object} message - Mensaje (se convertirá a string si es objeto)
   * @param {object} options - Opciones de publicación (qos, retain, etc.)
   */
  publish(topic, message, options = {}) {
    if (!this.client || !this.connected) {
      console.error('❌ No se puede publicar, cliente no conectado');
      return false;
    }

    const messageStr = typeof message === 'object' 
      ? JSON.stringify(message) 
      : message.toString();

    this.client.publish(topic, messageStr, options, (error) => {
      if (error) {
        console.error(`❌ Error al publicar en ${topic}:`, error);
      } else {
        console.log(`📤 Mensaje publicado a ${topic}`);
      }
    });

    return true;
  }

  /**
   * Manejar mensajes recibidos
   * @param {string} topic - Topic del mensaje
   * @param {Buffer} message - Mensaje recibido
   */
  async handleMessage(topic, message) {
    try {
      const messageStr = message.toString();
      
      // Guardar último mensaje del topic
      this.messages[topic] = {
        payload: messageStr,
        timestamp: new Date(),
        topic
      };

      console.log(`📥 [${topic}] ${messageStr}`);

      // Intentar parsear como JSON
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(messageStr);
      } catch (e) {
        parsedMessage = messageStr;
      }

      // Ejecutar handler personalizado si existe
      if (this.messageHandlers[topic]) {
        await this.messageHandlers[topic](parsedMessage, topic);
        return;
      }

      // Routing automático basado en el topic
      await this.routeMessage(topic, parsedMessage);

    } catch (error) {
      console.error(`❌ Error procesando mensaje de ${topic}:`, error);
    }
  }

  /**
   * Routing automático de mensajes según el topic
   * @param {string} topic - Topic del mensaje
   * @param {any} payload - Payload parseado
   */
  async routeMessage(topic, payload) {
    const topicParts = topic.split('/');

    // Formato: bins/{bin_id}/level
    if (topicParts[0] === 'bins' && topicParts[2] === 'level') {
      const bin_id = topicParts[1];
      const { distance_cm } = payload;
      await binController.processMqttData(bin_id, distance_cm);
    }

    // Formato: devices/{device_id}/heartbeat
    else if (topicParts[0] === 'devices' && topicParts[2] === 'heartbeat') {
      const device_id = topicParts[1];
      await deviceController.processMqttHeartbeat(device_id);
    }

    // Formato: devices/{device_id}/color
    else if (topicParts[0] === 'devices' && topicParts[2] === 'color') {
      const device_id = topicParts[1];
      const { classification, confidence, rgb } = payload;
      await deviceController.processMqttColorData(device_id, classification, confidence, rgb);
    }

    // Formato: devices/{device_id}/proximity
    else if (topicParts[0] === 'devices' && topicParts[2] === 'proximity') {
      const device_id = topicParts[1];
      const { distance_cm, trigger } = payload;
      await deviceController.processMqttProximityData(device_id, distance_cm, trigger);
    }

    // Topics personalizados
    else if (topic === '/test/comment') {
      console.log('💬 Comentario recibido:', payload);
    }
    else if (topic === '/test/temperatura') {
      console.log('🌡️  Temperatura:', payload);
    }
    else if (topic === '/test/humedad') {
      console.log('💧 Humedad:', payload);
    }
  }

  /**
   * Registrar handler personalizado para un topic
   * @param {string} topic - Topic a manejar
   * @param {function} handler - Función handler (recibe payload y topic)
   */
  registerHandler(topic, handler) {
    this.messageHandlers[topic] = handler;
    console.log(`🔧 Handler registrado para: ${topic}`);
  }

  /**
   * Obtener el último mensaje de un topic
   * @param {string} topic - Topic del que obtener el mensaje
   */
  getLastMessage(topic) {
    return this.messages[topic] || null;
  }

  /**
   * Obtener todos los mensajes almacenados
   */
  getAllMessages() {
    return this.messages;
  }

  /**
   * Iniciar chequeo periódico de devices offline
   */
  startOfflineCheck() {
    // Chequear cada 2 minutos
    this.offlineCheckInterval = setInterval(() => {
      deviceController.checkOfflineDevices();
    }, 2 * 60 * 1000);
    
    console.log('⏰ Iniciado chequeo de devices offline (cada 2 min)');
  }

  /**
   * Verificar si está conectado
   */
  isConnected() {
    return this.connected && this.client && this.client.connected;
  }

  /**
   * Desconectar del broker
   */
  disconnect() {
    if (this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval);
    }

    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
      console.log('👋 Desconectado del broker MQTT');
    }
  }
}

// Crear instancia singleton
const mqttClient = new MqttClient();

module.exports = mqttClient;

// ==========================================
// src/config/mqttConfig.js
// ==========================================

module.exports = {
  // Configuración del broker MQTT
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://10.12.252.56:1883',
  
  // Opciones de conexión
  options: {
    username: process.env.MQTT_USERNAME || 'JuanPayes',
    password: process.env.MQTT_PASSWORD || '1234',
    keepalive: 60,
    clean: true,
    reconnectPeriod: 1000,
  },

  // Topics a suscribirse
  topics: [
    // Bins
    'bins/+/level',
    
    // Devices
    'devices/+/heartbeat',
    'devices/+/color',
    'devices/+/proximity',
    
    // Topics de prueba
    '/test/comment',
    '/test/temperatura',
    '/test/humedad',
  ]
};

// ==========================================
// src/server.js - ACTUALIZADO
// ==========================================

const express = require('express');
const mongoose = require('mongoose');
const mqttClient = require('./mqtt/MqttClient');
const mqttConfig = require('./config/mqttConfig');

// Importar rutas
const areaRoutes = require('./routes/areaRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const binRoutes = require('./routes/binRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Rutas
app.use('/api/areas', areaRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/bins', binRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'API funcionando correctamente',
    mqtt_status: mqttClient.isConnected() ? 'connected' : 'disconnected'
  });
});

// Ruta para ver mensajes MQTT recientes
app.get('/api/mqtt/messages', (req, res) => {
  res.json({
    connected: mqttClient.isConnected(),
    messages: mqttClient.getAllMessages()
  });
});

// Ruta para publicar mensajes MQTT
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
    message: success ? 'Mensaje publicado' : 'Error al publicar'
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

// Conectar a MongoDB y luego a MQTT
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/warehouse_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Conectado a MongoDB');
  
  // Conectar a MQTT después de MongoDB
  mqttClient.connect(
    mqttConfig.brokerUrl,
    mqttConfig.options,
    mqttConfig.topics
  );

  // Ejemplo: Registrar un handler personalizado
  mqttClient.registerHandler('/test/comment', (payload, topic) => {
    console.log('💬 Handler personalizado - Comentario:', payload);
    // Aquí puedes guardar en DB, enviar notificaciones, etc.
  });

  // Iniciar servidor HTTP
  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });

  // Manejo de cierre graceful
  process.on('SIGINT', () => {
    console.log('\n👋 Cerrando aplicación...');
    mqttClient.disconnect();
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('✅ Aplicación cerrada correctamente');
        process.exit(0);
      });
    });
  });
})
.catch(err => {
  console.error('❌ Error conectando a MongoDB:', err);
  process.exit(1);
});

// ==========================================
// .env.example
// ==========================================

/*
# MongoDB
MONGODB_URI=mongodb://localhost:27017/warehouse_db

# MQTT Broker
MQTT_BROKER_URL=mqtt://10.12.252.56:1883
MQTT_USERNAME=JuanPayes
MQTT_PASSWORD=1234

# Server
PORT=3000
*/

// ==========================================
// package.json - Dependencias necesarias
// ==========================================

/*
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0",
    "mqtt": "^5.3.0",
    "dotenv": "^16.3.1"
  }
}
*/

// ==========================================
// Ejemplo de uso manual del cliente MQTT
// ==========================================

/*
const mqttClient = require('./mqtt/MqttClient');

// Suscribirse a un nuevo topic dinámicamente
mqttClient.subscribe('nuevo/topic');

// Publicar un mensaje
mqttClient.publish('bins/bin-001/command', {
  action: 'reset',
  timestamp: new Date()
});

// Obtener último mensaje de un topic
const lastMessage = mqttClient.getLastMessage('bins/bin-001/level');
console.log(lastMessage);

// Registrar handler personalizado
mqttClient.registerHandler('custom/topic', async (payload, topic) => {
  console.log('Procesando:', payload);
  // Tu lógica aquí
});
*/