const express = require('express');
const alertController = require('../controllers/alertController');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

router.use(requireAdminKey);
router.get('/', alertController.listAlerts);

module.exports = router;
