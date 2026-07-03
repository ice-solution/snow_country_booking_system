const express = require('express');
const websiteController = require('../controllers/websiteController');
const websiteValidators = require('../validators/websiteValidators');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/pricing', websiteController.getPricing);
router.get('/availability', websiteController.getAvailability);
router.post('/quote', websiteValidators.quote, validate, websiteController.getQuote);
router.post('/submit', websiteValidators.submit, validate, websiteController.submitBooking);
router.get(
  '/bookings/:id',
  websiteValidators.publicBooking,
  validate,
  websiteController.getPublicBooking
);

module.exports = router;
