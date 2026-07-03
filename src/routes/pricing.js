const express = require('express');
const pricingController = require('../controllers/pricingController');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

router.use(requireAdminKey);
router.get('/', pricingController.getPricing);
router.put('/', pricingController.updatePricing);

module.exports = router;
