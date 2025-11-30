const express = require('express');
const router = express.Router();
const smartBinController = require('../controllers/smartBinController');

router.post('/', smartBinController.createSmartBin);
router.get('/', smartBinController.getAllSmartBins);
router.get('/:id', smartBinController.getSmartBinById);
router.put('/:id', smartBinController.updateSmartBin);
router.delete('/:id', smartBinController.deleteSmartBin);
router.get('/:id/bins', smartBinController.getSmartBinBin);
router.get('/area/:areaId', smartBinController.getSmartBinsByArea);

router.get('/:device_id/color', smartBinController.getDeviceColor);
router.get('/:device_id/proximity', smartBinController.getDeviceProximity);
router.get('/:device_id/status', smartBinController.getDeviceStatus);

module.exports = router;