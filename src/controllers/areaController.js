const Area = require('../models/Area');
const SmartBin = require('../models/SmartBin');
const Bin = require('../models/Bin');

// Crear una nueva área - el front solo envía el nombre
exports.createArea = async (req, res) => {
  try {
    const { name } = req.body;

    // Validar campo requerido
    if (!name) {
      return res.status(400).json({
        error: 'El campo name es requerido'
      });
    }

    // Generar area_id automáticamente basado en el nombre
    const area_id = name.toLowerCase().trim().replace(/\s+/g, '_');

    // Verificar si el area_id ya existe
    const existingArea = await Area.findOne({ area_id });
    if (existingArea) {
      return res.status(409).json({
        error: 'Ya existe un área con ese nombre'
      });
    }

    // Crear área solo con nombre, devices será array vacío por defecto
    const newArea = new Area({
      area_id,
      name,
      devices: [] // Siempre inicia vacío
    });

    await newArea.save();

    res.status(201).json({
      message: 'Área creada exitosamente',
      data: newArea
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al crear el área',
      details: error.message
    });
  }
};

// Obtener todas las áreas
exports.getAllAreas = async (req, res) => {
  try {
    const areas = await Area.find().sort({ createdAt: -1 });

    res.status(200).json({
      count: areas.length,
      data: areas
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener las áreas',
      details: error.message
    });
  }
};

// Actualizar área - solo edita el nombre
exports.updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Validar que se envíe el nombre
    if (!name) {
      return res.status(400).json({
        error: 'El campo name es requerido'
      });
    }

    // Solo actualizar el nombre
    const updatedArea = await Area.findOneAndUpdate(
      { area_id: id },
      { name: name.trim() },
      { new: true, runValidators: true }
    );

    if (!updatedArea) {
      return res.status(404).json({
        error: 'Área no encontrada'
      });
    }

    res.status(200).json({
      message: 'Área actualizada exitosamente',
      data: updatedArea
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al actualizar el área',
      details: error.message
    });
  }
};

// Eliminar un área por area_id y todos sus SmartBins y Bins asociados
exports.deleteArea = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar el área
    const area = await Area.findOne({ area_id: id });

    if (!area) {
      return res.status(404).json({
        error: 'Área no encontrada'
      });
    }

    // Encontrar todos los SmartBins asociados a esta área (usando el ObjectId)
    const smartBins = await SmartBin.find({ areaId: area._id.toString() });

    let deletedDevices = 0;
    let deletedBins = 0;

    // Eliminar cada SmartBin y sus bins asociados
    for (const device of smartBins) {
      // Eliminar todos los bins del device
      const binsDeleteResult = await Bin.deleteMany({ device_id: device.device_id });
      deletedBins += binsDeleteResult.deletedCount;

      // Eliminar el device
      await SmartBin.findOneAndDelete({ device_id: device.device_id });
      deletedDevices++;
    }

    // Finalmente, eliminar el área
    await Area.findOneAndDelete({ area_id: id });

    res.status(200).json({
      message: 'Área y todos sus dispositivos eliminados exitosamente',
      data: {
        area: area,
        deleted_devices: deletedDevices,
        deleted_bins: deletedBins
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al eliminar el área',
      details: error.message
    });
  }
};

module.exports = exports;