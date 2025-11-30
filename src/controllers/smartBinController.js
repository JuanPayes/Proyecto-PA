const SmartBin = require('../models/SmartBin');
const Bin = require('../models/Bin');

const generateDeviceId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `device-${timestamp}${random}`;
};

exports.createSmartBin = async (req, res) => {
  try {
    const { name, areaId, client_id_mqtt } = req.body;
    if (!name || !areaId) {
      return res.status(400).json({
        error: 'Los campos name y areaId son requeridos'
      });
    }

    const Area = require('../models/Area');
    let area;

    if (areaId.match(/^[0-9a-fA-F]{24}$/)) {
      area = await Area.findById(areaId);
    } else {
      area = await Area.findOne({ area_id: areaId });
    }

    if (!area) {
      return res.status(404).json({
        error: 'El área especificada no existe'
      });
    }

    const device_id = generateDeviceId();

    const newDevice = new SmartBin({
      device_id,
      client_id_mqtt: client_id_mqtt,
      name,
      model: 'esp8266', 
      areaId: area._id.toString(),
      status: 'unknown',
      meta: {}
    });

    await newDevice.save();

    await Area.findByIdAndUpdate(
      area._id,
      { $addToSet: { devices: device_id } }
    );

    const bin_id = `${device_id}-aluminum`;

    const newBin = new Bin({
      bin_id,
      device_id,
      assigned_type: 'aluminum',
      level_percent: 0,
      meta: {}
    });

    await newBin.save();

    newDevice.binId = bin_id;
    await newDevice.save();

    res.status(201).json({
      message: 'SmartBin y bin creados exitosamente',
      data: {
        device: newDevice,
        bin: newBin
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al crear el SmartBin',
      details: error.message
    });
  }
};

exports.getAllSmartBins = async (req, res) => {
  try {
    const { areaId } = req.query;

    let filter = {};
    if (areaId) {
      filter.areaId = areaId;
    }

    const devices = await SmartBin.find(filter)
      .sort({ createdAt: -1 });

    // Obtener el bin de cada device manualmente
    const devicesWithBins = await Promise.all(
      devices.map(async (device) => {
        const bin = await Bin.findOne({ device_id: device.device_id });
        return {
          ...device.toObject(),
          binData: bin
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

exports.getSmartBinById = async (req, res) => {
  try {
    const { id } = req.params;

    const device = await SmartBin.findOne({ device_id: id });

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    const bin = await Bin.findOne({ device_id: id });

    res.status(200).json({
      data: {
        ...device.toObject(),
        binData: bin
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener el dispositivo',
      details: error.message
    });
  }
};

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

exports.deleteSmartBin = async (req, res) => {
  try {
    const { id } = req.params;

    const device = await SmartBin.findOne({ device_id: id });

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    const deletedBin = await Bin.findOneAndDelete({ device_id: id });

    const Area = require('../models/Area');
    await Area.findByIdAndUpdate(
      device.areaId,
      { $pull: { devices: id } }
    );

    await SmartBin.findOneAndDelete({ device_id: id });

    res.status(200).json({
      message: 'Dispositivo y su bin eliminados exitosamente',
      data: {
        device_id: id,
        bin_deleted: deletedBin ? true : false
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al eliminar el dispositivo',
      details: error.message
    });
  }
};

exports.getSmartBinBin = async (req, res) => {
  try {
    const { id } = req.params;

    const device = await SmartBin.findOne({ device_id: id });

    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo no encontrado'
      });
    }

    const bin = await Bin.findOne({ device_id: id });

    if (!bin) {
      return res.status(404).json({
        error: 'Bin no encontrado para este dispositivo'
      });
    }

    res.status(200).json({
      data: bin
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener el bin del dispositivo',
      details: error.message
    });
  }
};

exports.getSmartBinsByArea = async (req, res) => {
  try {
    const { areaId } = req.params;

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

    const devices = await SmartBin.find({ areaId: area._id.toString() })
      .sort({ createdAt: -1 });

    const devicesWithBins = await Promise.all(
      devices.map(async (device) => {
        const bin = await Bin.findOne({ device_id: device.device_id });
        return {
          ...device.toObject(),
          binData: bin
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

    if (status) {
      device.status = status;
    }

    if (client_id_mqtt) {
      device.client_id_mqtt = client_id_mqtt;
    }

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

exports.getDeviceStatus = async (req, res) => {
  try {
    const { device_id } = req.params;
    const device = await SmartBin.findOne({ device_id })
      .populate('bin_id', 'bin_id level_percent');

    if (!device) {
      return res.status(404).json({
        error: 'Device no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        device_id: device.device_id,
        status: device.status,
        last_color: device.last_color,
        last_proximity: device.last_proximity,
        bin: device.bin_id,
        last_seen: device.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener estado del device',
      details: error.message
    });
  }
};

exports.getDeviceProximity = async (req, res) => {
  try {
    const { device_id } = req.params;
    const device = await SmartBin.findOne({ device_id });

    if (!device) {
      return res.status(404).json({
        error: 'Device no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        device_id: device.device_id,
        proximity: device.last_proximity || null
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener proximidad del device',
      details: error.message
    });
  }
};

exports.getDeviceColor = async (req, res) => {
  try {
    const { device_id } = req.params;
    const device = await SmartBin.findOne({ device_id });

    if (!device) {
      return res.status(404).json({
        error: 'Device no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        device_id: device.device_id,
        color: device.last_color || null
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener color del device',
      details: error.message
    });
  }
};


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