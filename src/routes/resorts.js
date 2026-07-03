const express = require('express');
const resortController = require('../controllers/resortController');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

router.use(requireAdminKey);
router.get('/', resortController.getResorts);
router.put('/', resortController.updateResorts);

module.exports = router;
