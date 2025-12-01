module.exports = {
  brokerUrl: process.env.MQTT_BROKER_URL,
  
  options: {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    keepalive: 60,
    clean: true,
    reconnectPeriod: 1000,
  },

  topics: [
    '/smartbin/color',      // Color detectado
    '/smartbin/proximity',  // Datos de proximidad
    '/smartbin/level',      // Nivel de llenado
    
    '/test/comment',
  ]
};
