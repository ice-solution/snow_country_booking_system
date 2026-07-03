const express = require('express');
const integrationController = require('../controllers/integrationController');
const integrationValidators = require('../validators/integrationValidators');
const klookValidators = require('../validators/klookValidators');
const validate = require('../middleware/validate');
const requireIntegrationKey = require('../middleware/requireIntegrationKey');

const router = express.Router();

router.get('/meta', requireIntegrationKey, integrationController.getIntegrationMeta);

router.use(requireIntegrationKey);

router.post(
  '/bookings',
  integrationValidators.createBooking,
  validate,
  integrationController.createIntegrationBooking
);

router.post(
  '/klook/parse',
  klookValidators.parse,
  validate,
  integrationController.parseKlookEmailPreview
);

router.post(
  '/klook/import',
  klookValidators.import,
  validate,
  integrationController.importKlookEmail
);

module.exports = router;
