const mqtt = require('mqtt');
const binController = require('../controllers/binController');
const deviceController = require('../controllers/smartBinController');
const SmartBin = require('../models/SmartBin');

class MqttClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.messages = {};
    this.messageHandlers = {}; 
  }

  connect(brokerUrl, options = {}, topics = []) {
    if (this.client) {
      console.log('⚠️  Cliente MQTT ya está conectado');
      return;
    }

    const defaultOptions = {
      clientId: `backend_smartbin_${Math.random().toString(16).substr(2, 8)}`,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      ...options
    };

    console.log(`🔌 Conectando a MQTT Broker: ${brokerUrl}...`);
    console.log(`👤 Usuario: ${options.username || 'sin usuario'}`);
    
    this.client = mqtt.connect(brokerUrl, defaultOptions);

    this.client.on('connect', () => {
      this.connected = true;
      console.log('✅ Conectado al broker MQTT');
      console.log(`📋 Cliente ID: ${defaultOptions.clientId}`);

      if (topics && topics.length > 0) {
        this.subscribe(topics);
      }
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });

    this.client.on('error', (error) => {
      console.error('❌ Error MQTT:', error.message);
    });

    this.client.on('reconnect', () => {
      console.log('🔄 Reconectando al broker MQTT...');
    });

    this.client.on('close', () => {
      this.connected = false;
      console.log('⚠️  Desconectado del broker MQTT');
    });

    this.client.on('offline', () => {
      this.connected = false;
      console.log('📴 Cliente MQTT offline');
    });
  }

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

  async handleMessage(topic, message) {
    try {
      const messageStr = message.toString();
      
      this.messages[topic] = {
        payload: messageStr,
        timestamp: new Date(),
        topic
      };

      console.log(`📥 [${topic}] ${messageStr}`);

      let parsedMessage;
      try {
        parsedMessage = JSON.parse(messageStr);
      } catch (e) {
        console.error('⚠️  Mensaje no es JSON válido:', messageStr);
        return;
      }

      if (this.messageHandlers[topic]) {
        await this.messageHandlers[topic](parsedMessage, topic);
        return;
      }

      await this.routeMessage(topic, parsedMessage);

    } catch (error) {
      console.error(`❌ Error procesando mensaje de ${topic}:`, error);
    }
  }

  async routeMessage(topic, payload) {
    try {
      if (topic === '/smartbin/color') {
        const { client_id_mqtt, classification, confidence, rgb } = payload;
        
        if (!client_id_mqtt) {
          console.error('⚠️  Color recibido sin client_id_mqtt');
          return;
        }
        
        console.log('🎨 Procesando color detectado:', {
          client_id_mqtt,
          classification,
          confidence,
          rgb
        });

        const device = await SmartBin.findOne({ client_id_mqtt });
        
        if (!device) {
          console.error(`⚠️  Device con client_id_mqtt "${client_id_mqtt}" no encontrado en la BD`);
          console.log('💡 Asegúrate de crear el device primero con POST /api/devices');
          return;
        }

        const result = await deviceController.processMqttSmartBinData(device.device_id, {
          color: {
            classification,
            confidence,
            rgb
          }
        });

        if (result.success) {
          console.log(`✅ Color actualizado para device ${device.device_id} (MQTT: ${client_id_mqtt})`);
        } else {
          console.error(`❌ Error actualizando color: ${result.error}`);
        }
      }

      else if (topic === '/smartbin/proximity') {
        const { client_id_mqtt, distance_cm, triggaer } = payload;
        
        if (!client_id_mqtt) {
          console.error('⚠️  Proximidad recibida sin client_id_mqtt');
          return;
        }
        
        console.log('👁️  Procesando proximidad:', {
          client_id_mqtt,
          distance_cm,
          trigger
        });

        const device = await SmartBin.findOne({ client_id_mqtt });
        
        if (!device) {
          console.error(`⚠️  Device con client_id_mqtt "${client_id_mqtt}" no encontrado en la BD`);
          console.log('💡 Asegúrate de crear el device primero con POST /api/devices');
          return;
        }

        const result = await deviceController.processMqttSmartBinData(device.device_id, {
          proximity: {
            distance_cm,
            trigger
          }
        });

        if (result.success) {
          console.log(`✅ Proximidad actualizada para device ${device.device_id} (MQTT: ${client_id_mqtt})`);
        } else {
          console.error(`❌ Error actualizando proximidad: ${result.error}`);
        }
      }

      else if (topic === '/smartbin/level') {
        const { client_id_mqtt, level_percent } = payload;
        
        if (!client_id_mqtt) {
          console.error('⚠️  Nivel recibido sin client_id_mqtt');
          return;
        }
        
        console.log('📊 Procesando nivel de llenado:', {
          client_id_mqtt,
          level_percent
        });

        const device = await SmartBin.findOne({ client_id_mqtt });
        
        if (!device) {
          console.error(`⚠️  Device con client_id_mqtt "${client_id_mqtt}" no encontrado en la BD`);
          console.log('💡 Asegúrate de crear el device primero con POST /api/devices');
          return;
        }

        if (!device.binId) {
          console.error(`⚠️  Device ${device.device_id} no tiene bin asociado (binId es null)`);
          console.log('💡 El bin debería crearse automáticamente al crear el device');
          return;
        }

        const result = await binController.processMqttData(device.binId, level_percent);
        
        if (result.success) {
          console.log(`✅ Nivel actualizado: ${device.binId} -> ${level_percent}% (Device: ${device.device_id}, MQTT: ${client_id_mqtt})`);
        } else {
          console.error(`❌ Error actualizando nivel: ${result.error}`);
        }
      }

      else if (topic === '/test/comment') {
        console.log('💬 Comentario recibido:', payload);
      }

      else {
        console.log('⚠️  Topic no reconocido:', topic);
        console.log('📋 Topics disponibles: /smartbin/color, /smartbin/proximity, /smartbin/level');
      }

    } catch (error) {
      console.error('❌ Error en routing de mensaje:', error);
      console.error('Stack trace:', error.stack);
    }
  }

  registerHandler(topic, handler) {
    this.messageHandlers[topic] = handler;
    console.log(`🔧 Handler registrado para: ${topic}`);
  }

  getLastMessage(topic) {
    return this.messages[topic] || null;
  }

  getAllMessages() {
    return this.messages;
  }

  isConnected() {
    return this.connected && this.client && this.client.connected;
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
      console.log('👋 Desconectado del broker MQTT');
    }
  }
}

const mqttClient = new MqttClient();

module.exports = mqttClient;