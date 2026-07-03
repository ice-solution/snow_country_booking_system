const express = require('express');
const coachController = require('../controllers/coachController');
const ganttController = require('../controllers/ganttController');
const coachValidators = require('../validators/coachValidators');
const validate = require('../middleware/validate');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

router.use(requireAdminKey);

router.get('/', coachController.listCoaches);
router.get('/leave-requests/pending', coachController.listPendingLeaveRequests);
router.get('/:id/schedule', ganttController.getCoachSchedule);
router.get('/:id', coachController.getCoach);
router.post('/', coachValidators.create, validate, coachController.createCoach);
router.put('/:id', coachValidators.update, validate, coachController.updateCoach);
router.delete('/:id', coachController.deleteCoach);
router.post(
  '/:id/block-date',
  coachValidators.blockDate,
  validate,
  coachController.blockDate
);
router.post(
  '/:id/unblock-date',
  coachValidators.unblockDate,
  validate,
  coachController.unblockDate
);
router.post(
  '/:id/leave-requests/:requestId/review',
  coachController.reviewLeaveRequest
);

module.exports = router;
