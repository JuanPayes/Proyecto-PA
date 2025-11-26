// src/routes/smartBinRoutes.js
const express = require('express');
const router = express.Router();
const smartBinController = require('../controllers/smartBinController');

// ==========================================
// RUTAS CRUD DE DEVICES
// ==========================================

/**
 * POST /api/devices
 * Crear un nuevo dispositivo SmartBin
 * Body: { device_id, bins?, meta? }
 */
router.post('/', smartBinController.createSmartBin);

/**
 * GET /api/devices
 * Obtener todos los dispositivos
 * Puede incluir populate de bins
 */
router.get('/', smartBinController.getAllSmartBins);

/**
 * GET /api/devices/:id
 * Obtener un dispositivo específico por device_id
 * Incluye información de sus bins asociados
 */
router.get('/:id', smartBinController.getSmartBinById);

/**
 * PUT /api/devices/:id
 * Actualizar información de un dispositivo
 * Body: { location?, meta?, etc }
 */
router.put('/:id', smartBinController.updateSmartBin);

/**
 * DELETE /api/devices/:id
 * Eliminar un dispositivo y todos sus bins asociados
 */
router.delete('/:id', smartBinController.deleteSmartBin);

// ==========================================
// RUTAS ESPECÍFICAS DE OPERACIONES
// ==========================================

/**
 * GET /api/devices/:id/bins
 * Obtener todos los bins de un dispositivo específico
 */
router.get('/:id/bins', smartBinController.getSmartBinBins);


module.exports = router;