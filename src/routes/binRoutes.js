const express = require('express');
const router = express.Router();
const binController = require('../controllers/binController');

router.get('/', binController.getAllBins);
router.get('/:bin_id', binController.getBinById);
router.delete('/:bin_id', binController.deleteBin);

// Endpoints específicos para nivel (MQTT)
router.post('/:bin_id/level', binController.updateBinLevel);
router.get('/:bin_id/level', binController.getBinLevel);

// Endpoints para filtros útiles
router.get('/status/:status', binController.getBinsByStatus);

module.exports = router;