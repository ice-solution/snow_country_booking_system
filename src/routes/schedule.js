const express = require('express');
const scheduleController = require('../controllers/scheduleController');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

router.use(requireAdminKey);
router.get('/', scheduleController.getSchedule);

module.exports = router;
