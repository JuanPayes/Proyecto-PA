module.exports = {
  // Configuración del broker MQTT
  brokerUrl: process.env.MQTT_BROKER_URL,
  
  // Opciones de conexión
  options: {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    keepalive: 60,
    clean: true,
    reconnectPeriod: 1000,
  },

  // Topics específicos para SmartBin (sin wildcards por ahora)
  topics: [
    '/smartbin/color',      // Color detectado
    '/smartbin/proximity',  // Datos de proximidad
    '/smartbin/level',      // Nivel de llenado
    
    // Topics de prueba (puedes comentar después)
    '/test/comment',
  ]
};
