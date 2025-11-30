const Bin = require('../models/Bin');
const Device = require('../models/SmartBin');

// Obtener todos los bins (con filtro opcional por device_id)
exports.getAllBins = async (req, res) => {
  try {
    const { device_id } = req.query;

    let filter = {};
    if (device_id) {
      filter.device_id = device_id;
    }

    const bins = await Bin.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      count: bins.length,
      data: bins
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener los bins',
      details: error.message
    });
  }
};

// Obtener un bin específico por bin_id
exports.getBinById = async (req, res) => {
  try {
    const { id } = req.params;

    const bin = await Bin.findOne({ bin_id: id });

    if (!bin) {
      return res.status(404).json({
        error: 'Bin no encontrado'
      });
    }

    res.status(200).json({
      data: bin
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener el bin',
      details: error.message
    });
  }
};

// Obtener el bin asociado a un device_id específico
exports.getBinByDeviceId = async (req, res) => {
  try {
    const { device_id } = req.params;

    const bin = await Bin.findOne({ device_id });

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

// Eliminar un bin específico
exports.deleteBin = async (req, res) => {
  try {
    const { id } = req.params;
    const bin = await Bin.findOne({ bin_id: id });

    if (!bin) {
      return res.status(404).json({
        error: 'Bin no encontrado'
      });
    }

    // Limpiar la referencia en el device
    await Device.findOneAndUpdate(
      { device_id: bin.device_id },
      { $unset: { binId: "" } }
    );

    await Bin.findOneAndDelete({ bin_id: id });

    res.status(200).json({
      message: 'Bin eliminado exitosamente',
      data: bin
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al eliminar el bin',
      details: error.message
    });
  }
};

// ==========================================
// MQTT DATA HANDLING
// ==========================================

/**
 * Actualizar nivel del bin basado en datos MQTT
 * Este método será llamado cuando lleguen datos del sensor vía MQTT
 * 
 * Payload esperado del MQTT:
 * {
 *   bin_id: "device-abc123-aluminum",
 *   level_percent: 75.5,
 *   timestamp: "2024-11-25T10:30:00Z"
 * }
 */
exports.updateBinLevel = async (req, res) => {
  try {
    const { bin_id, level_percent, timestamp } = req.body;

    // Validar datos requeridos
    if (!bin_id || level_percent === undefined) {
      return res.status(400).json({
        error: 'Se requieren bin_id y level_percent'
      });
    }

    // Validar que level_percent esté en el rango válido
    if (level_percent < 0 || level_percent > 100) {
      return res.status(400).json({
        error: 'level_percent debe estar entre 0 y 100'
      });
    }

    // Buscar el bin
    const bin = await Bin.findOne({ bin_id });
    if (!bin) {
      return res.status(404).json({
        error: 'Bin no encontrado'
      });
    }

    // Actualizar el bin directamente con el valor recibido de MQTT
    bin.level_percent = Math.round(level_percent * 100) / 100;

    // Actualizar meta con el timestamp si se proporciona
    if (timestamp) {
      bin.meta = {
        ...bin.meta,
        last_update: new Date(timestamp)
      };
    }

    await bin.save();

    res.status(200).json({
      message: 'Nivel del bin actualizado exitosamente',
      data: {
        bin_id: bin.bin_id,
        level_percent: bin.level_percent,
        status: bin.level_percent >= 80 ? 'nearly_full' : bin.level_percent >= 50 ? 'half_full' : 'available',
        updated_at: bin.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al actualizar el nivel del bin',
      details: error.message
    });
  }
};


exports.getBinLevel = async (req, res) => {
  try {
    const { bin_id } = req.params;
    const bin = await Bin.findOne({ bin_id });

    if (!bin) {
      return res.status(404).json({
        error: 'Bin no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        bin_id: bin.bin_id,
        level_percent: bin.level_percent,
        status: bin.level_percent >= 80 ? 'nearly_full' : 
                bin.level_percent >= 50 ? 'half_full' : 'available',
        last_update: bin.meta?.last_update || bin.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener nivel del bin',
      details: error.message
    });
  }
};

exports.getBinsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    
    let query = {};
    
    // Filtrar por nivel según el estado
    switch(status) {
      case 'nearly_full':
        query.level_percent = { $gte: 80 };
        break;
      case 'half_full':
        query.level_percent = { $gte: 50, $lt: 80 };
        break;
      case 'available':
        query.level_percent = { $lt: 50 };
        break;
      default:
        return res.status(400).json({
          error: 'Estado inválido. Use: nearly_full, half_full, available'
        });
    }

    const bins = await Bin.find(query)
      .populate('area_id', 'name')
      .sort({ level_percent: -1 });

    res.status(200).json({
      success: true,
      status: status,
      count: bins.length,
      data: bins
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener bins por estado',
      details: error.message
    });
  }
};

exports.processMqttData = async (bin_id, level_percent, timestamp = null) => {
  try {
    const bin = await Bin.findOne({ bin_id });
    if (!bin) {
      console.error(`Bin ${bin_id} no encontrado`);
      return { success: false, error: 'Bin no encontrado' };
    }

    // Validar rango
    if (level_percent < 0 || level_percent > 100) {
      console.error(`level_percent fuera de rango: ${level_percent}`);
      return { success: false, error: 'level_percent fuera de rango' };
    }

    // Actualizar directamente con el valor de MQTT
    bin.level_percent = Math.round(level_percent * 100) / 100;

    // Actualizar meta con timestamp
    if (timestamp) {
      bin.meta = {
        ...bin.meta,
        last_update: new Date(timestamp)
      };
    }

    await bin.save();

    console.log(`✅ Bin ${bin_id} actualizado: ${bin.level_percent}%`);

    return {
      success: true,
      data: {
        bin_id,
        level_percent: bin.level_percent,
        updated_at: bin.updatedAt
      }
    };
  } catch (error) {
    console.error('Error procesando datos MQTT:', error);
    return { success: false, error: error.message };
  }
};

module.exports = exports;