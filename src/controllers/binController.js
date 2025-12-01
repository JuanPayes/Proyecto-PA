const Bin = require('../models/Bin');
const Device = require('../models/SmartBin');

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

exports.deleteBin = async (req, res) => {
  try {
    const { id } = req.params;
    const bin = await Bin.findOne({ bin_id: id });

    if (!bin) {
      return res.status(404).json({
        error: 'Bin no encontrado'
      });
    }

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

exports.updateBinLevel = async (req, res) => {
  try {
    const { bin_id, level_percent, timestamp } = req.body;

    if (!bin_id || level_percent === undefined) {
      return res.status(400).json({
        error: 'Se requieren bin_id y level_percent'
      });
    }

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

    bin.level_percent = Math.round(level_percent * 100) / 100;

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

    if (level_percent < 0 || level_percent > 100) {
      console.error(`level_percent fuera de rango: ${level_percent}`);
      return { success: false, error: 'level_percent fuera de rango' };
    }

    bin.level_percent = Math.round(level_percent * 100) / 100;

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