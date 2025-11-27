// src/controllers/smartBinController.js
const SmartBin = require('../models/SmartBin');
const Bin = require('../models/Bin');

// Función para generar ID único simple (sin necesidad de librería uuid)
const generateDeviceId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `device-${timestamp}${random}`;
};

// ==========================================
// CREAR SMARTBIN CON SUS 2 BINS AUTOMÁTICAMENTE
// ==========================================

/**
 * Crear un SmartBin y automáticamente crear sus 2 bins (plastic y aluminum)
 * El usuario solo proporciona: name y areaId
 * Se generan automáticamente: device_id, bin_ids
 * MQTT proporcionará después: client_id_mqtt, last_color, last_proximity, status
 */
exports.createSmartBin = async (req, res) => {
  try {
    const { name, areaId } = req.body;

    // Validar campos requeridos
    if (!name || !areaId) {
      return res.status(400).json({
        error: 'Los campos name y areaId son requeridos'
      });
    }

    // Verificar que el área existe (buscar por area_id o _id)
    const Area = require('../models/Area');
    let area;

    // Si areaId parece ser un ObjectId (24 caracteres hex), buscar por _id
    if (areaId.match(/^[0-9a-fA-F]{24}$/)) {
      area = await Area.findById(areaId);
    } else {
      // Si no, buscar por area_id (string como "dei")
      area = await Area.findOne({ area_id: areaId });
    }

    if (!area) {
      return res.status(404).json({
        error: 'El área especificada no existe'
      });
    }

    // Generar device_id único automáticamente
    const device_id = generateDeviceId();

    // Crear el SmartBin usando el ObjectId del área
    const newDevice = new SmartBin({
      device_id,
      name,
      model: 'esp8266', // valor por defecto
      areaId: area._id.toString(), // Guardar el ObjectId
      bins: [], // Se llenará después de crear los bins
      status: 'unknown', // MQTT lo actualizará
      meta: {}
    });

    await newDevice.save();

    // Actualizar el área para agregar el device_id
    await Area.findByIdAndUpdate(
      area._id,
      { $addToSet: { devices: device_id } }
    );

    // Crear automáticamente los 2 bins
    const binTypes = ['plastic', 'aluminum'];
    const createdBins = [];

    for (const type of binTypes) {
      const bin_id = `${device_id}-${type}`;

      const newBin = new Bin({
        bin_id,
        device_id,
        assigned_type: type,
        level_percent: 0, // MQTT lo actualizará
        meta: {}
      });

      await newBin.save();
      createdBins.push(bin_id);
    }

    // Actualizar el device con los bin_ids creados
    newDevice.bins = createdBins;
    await newDevice.save();

    // Obtener los bins creados con sus datos completos
    const binsData = await Bin.find({ device_id });

    res.status(201).json({
      message: 'SmartBin y bins creados exitosamente',
      data: {
        device: newDevice,
        bins: binsData
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al crear el SmartBin',
      details: error.message
    });
  }
};

// ==========================================
// OBTENER TODOS LOS DEVICES
// ==========================================

exports.getAllSmartBins = async (req, res) => {
  try {
    const { areaId } = req.query;

    let filter = {};
    if (areaId) {
      filter.areaId = areaId;
    }

    const devices = await SmartBin.find(filter)
      .sort({ createdAt: -1 });

    // Obtener los bins de cada device manualmente
    const devicesWithBins = await Promise.all(
      devices.map(async (device) => {
        const bins = await Bin.find({ device_id: device.device_id });
        return {
          ...device.toObject(),
          binsData: bins
        };
      })
    );

    res.status(200).json({
      count: devicesWithBins.length,
      data: devicesWithBins
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener los dispositivos',
      details: error.message
    });
  }
};

// ==========================================
// OBTENER UN DEVICE POR ID
// ==========================================

exports.getSmartBinById = async (req, res) => {
  try {
    const { id } = req.params;

    const device = await SmartBin.findOne({ device_id: id });

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    // Obtener los bins del device
    const bins = await Bin.find({ device_id: id });

    res.status(200).json({
      data: {
        ...device.toObject(),
        binsData: bins
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener el dispositivo',
      details: error.message
    });
  }
};

// ==========================================
// ACTUALIZAR DEVICE
// ==========================================

exports.updateSmartBin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, areaId, meta } = req.body;

    const device = await SmartBin.findOne({ device_id: id });

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    // Actualizar solo los campos permitidos
    if (name) device.name = name;
    if (areaId) device.areaId = areaId;
    if (meta) device.meta = { ...device.meta, ...meta };

    await device.save();

    res.status(200).json({
      message: 'Dispositivo actualizado exitosamente',
      data: device
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al actualizar el dispositivo',
      details: error.message
    });
  }
};

// ==========================================
// ELIMINAR DEVICE Y SUS BINS
// ==========================================

exports.deleteSmartBin = async (req, res) => {
  try {
    const { id } = req.params;

    const device = await SmartBin.findOne({ device_id: id });

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    // Eliminar todos los bins asociados
    await Bin.deleteMany({ device_id: id });

    // Remover el device_id del área
    const Area = require('../models/Area');
    await Area.findByIdAndUpdate(
      device.areaId,
      { $pull: { devices: id } }
    );

    // Eliminar el device
    await SmartBin.findOneAndDelete({ device_id: id });

    res.status(200).json({
      message: 'Dispositivo y sus bins eliminados exitosamente',
      data: {
        device_id: id,
        bins_deleted: device.bins.length
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al eliminar el dispositivo',
      details: error.message
    });
  }
};

// ==========================================
// OBTENER BINS DE UN DEVICE
// ==========================================

exports.getSmartBinBins = async (req, res) => {
  try {
    const { id } = req.params;

    const device = await SmartBin.findOne({ device_id: id });

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    const bins = await Bin.find({ device_id: id }).sort({ assigned_type: 1 });

    res.status(200).json({
      count: bins.length,
      data: bins
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener los bins del dispositivo',
      details: error.message
    });
  }
};

exports.getSmartBinsByArea = async (req, res) => {
  try {
    const { areaId } = req.params;

    // Buscar el área (soporta area_id o ObjectId)
    const Area = require('../models/Area');
    let area;
    
    if (areaId.match(/^[0-9a-fA-F]{24}$/)) {
      area = await Area.findById(areaId);
    } else {
      area = await Area.findOne({ area_id: areaId });
    }
    
    if (!area) {
      return res.status(404).json({
        error: 'Área no encontrada'
      });
    }

    // Buscar devices por el ObjectId del área
    const devices = await SmartBin.find({ areaId: area._id.toString() })
      .sort({ createdAt: -1 });

    // Obtener los bins de cada device
    const devicesWithBins = await Promise.all(
      devices.map(async (device) => {
        const bins = await Bin.find({ device_id: device.device_id });
        return {
          ...device.toObject(),
          binsData: bins
        };
      })
    );

    res.status(200).json({
      count: devicesWithBins.length,
      data: devicesWithBins,
      area: {
        _id: area._id,
        area_id: area.area_id,
        name: area.name
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener los dispositivos del área',
      details: error.message
    });
  }
};


// ==========================================
// MQTT DATA HANDLING
// ==========================================

/**
 * Actualizar estado de conexión del dispositivo (para MQTT)
 * Payload esperado:
 * {
 *   status: "online" | "offline",
 *   client_id_mqtt: "esp8266_abc123",
 *   timestamp: "2024-11-25T10:30:00Z"
 * }
 */
exports.updateSmartBinStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, client_id_mqtt, timestamp } = req.body;

    const device = await SmartBin.findOne({ device_id: id });

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    // Actualizar status y client_id_mqtt
    if (status) {
      device.status = status;
    }

    if (client_id_mqtt) {
      device.client_id_mqtt = client_id_mqtt;
    }

    // Actualizar meta con timestamp
    if (timestamp) {
      device.meta = {
        ...device.meta,
        last_status_update: new Date(timestamp)
      };
    }

    await device.save();

    res.status(200).json({
      message: 'Estado del dispositivo actualizado',
      data: {
        device_id: device.device_id,
        status: device.status,
        client_id_mqtt: device.client_id_mqtt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al actualizar el estado del dispositivo',
      details: error.message
    });
  }
};

/**
 * Actualizar datos de color detectado (para MQTT)
 * Payload esperado:
 * {
 *   classification: "plastic",
 *   confidence: 0.95,
 *   rgb: [255, 0, 0],
 *   timestamp: "2024-11-25T10:30:00Z"
 * }
 */
exports.updateSmartBinColor = async (req, res) => {
  try {
    const { id } = req.params;
    const { classification, confidence, rgb, timestamp } = req.body;

    const device = await SmartBin.findOne({ device_id: id });

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    device.last_color = {
      classification,
      confidence,
      rgb,
      ts: timestamp ? new Date(timestamp) : new Date()
    };

    await device.save();

    res.status(200).json({
      message: 'Color detectado actualizado',
      data: device.last_color
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al actualizar el color detectado',
      details: error.message
    });
  }
};

/**
 * Actualizar datos de proximidad (para MQTT)
 * Payload esperado:
 * {
 *   distance_cm: 15.5,
 *   trigger: true,
 *   timestamp: "2024-11-25T10:30:00Z"
 * }
 */
exports.updateSmartBinProximity = async (req, res) => {
  try {
    const { id } = req.params;
    const { distance_cm, trigger, timestamp } = req.body;

    const device = await SmartBin.findOne({ device_id: id });

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    device.last_proximity = {
      distance_cm,
      trigger,
      ts: timestamp ? new Date(timestamp) : new Date()
    };

    await device.save();

    res.status(200).json({
      message: 'Proximidad actualizada',
      data: device.last_proximity
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al actualizar la proximidad',
      details: error.message
    });
  }
};

/**
 * Método auxiliar para procesar datos MQTT del dispositivo (sin HTTP response)
 */
exports.processMqttSmartBinData = async (device_id, data) => {
  try {
    const device = await SmartBin.findOne({ device_id });

    if (!device) {
      console.error(`Device ${device_id} no encontrado`);
      return { success: false, error: 'Device no encontrado' };
    }

    // Actualizar según el tipo de datos recibidos
    if (data.status) {
      device.status = data.status;
    }

    if (data.client_id_mqtt) {
      device.client_id_mqtt = data.client_id_mqtt;
    }

    if (data.color) {
      device.last_color = {
        classification: data.color.classification,
        confidence: data.color.confidence,
        rgb: data.color.rgb,
        ts: new Date()
      };
    }

    if (data.proximity) {
      device.last_proximity = {
        distance_cm: data.proximity.distance_cm,
        trigger: data.proximity.trigger,
        ts: new Date()
      };
    }

    await device.save();

    console.log(`✅ Device ${device_id} actualizado via MQTT`);

    return { success: true, data: device };
  } catch (error) {
    console.error('Error procesando datos MQTT del device:', error);
    return { success: false, error: error.message };
  }
};

module.exports = exports;