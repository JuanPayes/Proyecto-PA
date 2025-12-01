const Area = require('../models/Area');
const SmartBin = require('../models/SmartBin');
const Bin = require('../models/Bin');

exports.createArea = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'El campo name es requerido'
      });
    }

    const area_id = name.toLowerCase().trim();

    const existingArea = await Area.findOne({ area_id });
    if (existingArea) {
      return res.status(409).json({
        error: 'Ya existe un área con ese nombre'
      });
    }

    const newArea = new Area({
      area_id,
      name,
      devices: []
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

exports.updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'El campo name es requerido'
      });
    }

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

exports.deleteArea = async (req, res) => {
  try {
    const { id } = req.params;

    const area = await Area.findOne({ area_id: id });

    if (!area) {
      return res.status(404).json({
        error: 'Área no encontrada'
      });
    }

    const smartBins = await SmartBin.find({ areaId: area._id.toString() });

    let deletedDevices = 0;
    let deletedBins = 0;

    for (const device of smartBins) {
      const binsDeleteResult = await Bin.deleteMany({ device_id: device.device_id });
      deletedBins += binsDeleteResult.deletedCount;

      await SmartBin.findOneAndDelete({ device_id: device.device_id });
      deletedDevices++;
    }

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