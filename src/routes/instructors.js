const express = require('express');
const instructorController = require('../controllers/instructorController');
const ganttController = require('../controllers/ganttController');
const instructorValidators = require('../validators/instructorValidators');
const validate = require('../middleware/validate');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

router.use(requireAdminKey);

router.get('/', instructorController.listInstructors);
router.get('/leave-requests/pending', instructorController.listPendingLeaveRequests);
router.get('/:id/schedule', ganttController.getInstructorSchedule);
router.get('/:id', instructorController.getInstructor);
router.post('/', instructorValidators.create, validate, instructorController.createInstructor);
router.put('/:id', instructorValidators.update, validate, instructorController.updateInstructor);
router.delete('/:id', instructorController.deleteInstructor);
router.post(
  '/:id/block-date',
  instructorValidators.blockDate,
  validate,
  instructorController.blockDate
);
router.post(
  '/:id/unblock-date',
  instructorValidators.unblockDate,
  validate,
  instructorController.unblockDate
);
router.post(
  '/:id/leave-requests/:requestId/review',
  instructorController.reviewLeaveRequest
);

module.exports = router;
