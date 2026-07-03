const express = require('express');
const capacityController = require('../controllers/capacityController');

const router = express.Router();

router.get('/', capacityController.getCapacity);

module.exports = router;
