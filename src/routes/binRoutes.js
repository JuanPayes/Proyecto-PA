// src/routes/binRoutes.js
const express = require('express');
const router = express.Router();
const binController = require('../controllers/binController');

// ==========================================
// NOTA: RUTAS CREADAS JUST IN CASE, NO CREO QUE SE USEN PORQUE SMARTBIN YA HACE ESTOS PROCESOS, PERO QUIZAS LUEGO HAYAN OTRAS DE MQTT
// ==========================================

router.get('/', binController.getAllBins);
router.get('/:id', binController.getBinById);
router.delete('/:id', binController.deleteBin);
router.put('/level', binController.updateBinLevel);

module.exports = router;