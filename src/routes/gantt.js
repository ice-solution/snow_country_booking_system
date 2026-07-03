const express = require('express');
const ganttController = require('../controllers/ganttController');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

router.use(requireAdminKey);
router.get('/', ganttController.getGantt);

module.exports = router;
