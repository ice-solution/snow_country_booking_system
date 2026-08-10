const express = require('express');
const bookingController = require('../controllers/bookingController');
const bookingValidators = require('../validators/bookingValidators');
const validate = require('../middleware/validate');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

router.post(
  '/calculate-instructors',
  bookingValidators.calculate,
  validate,
  bookingController.calculateInstructors
);

router.post('/', bookingValidators.create, validate, bookingController.createBooking);

router.get('/', requireAdminKey, bookingValidators.list, validate, bookingController.listBookings);
router.get('/:id/guest', requireAdminKey, bookingController.getBookingGuest);
router.get('/:id', requireAdminKey, bookingController.getBooking);
router.put(
  '/:id',
  requireAdminKey,
  bookingValidators.update,
  validate,
  bookingController.updateBooking
);
router.post('/:id/confirm', requireAdminKey, bookingController.confirmBooking);
router.post('/:id/cancel', requireAdminKey, bookingController.cancelBooking);
router.post('/:id/needs-attention', requireAdminKey, bookingController.markNeedsAttention);
router.post('/:id/resolve', requireAdminKey, bookingController.resolveBooking);
router.post('/:id/complete', requireAdminKey, bookingController.completeBooking);
router.get('/:id/suggest-instructors', requireAdminKey, bookingController.suggestInstructors);
router.post(
  '/:id/assign',
  requireAdminKey,
  bookingValidators.assign,
  validate,
  bookingController.assignInstructors
);
router.post(
  '/:id/reassign',
  requireAdminKey,
  bookingValidators.assign,
  validate,
  bookingController.reassignInstructors
);
router.post('/:id/auto-assign', requireAdminKey, bookingController.autoAssignInstructors);
router.post('/:id/auto-reassign', requireAdminKey, bookingController.autoReassignInstructors);
router.post(
  '/:id/move-slot',
  requireAdminKey,
  bookingValidators.moveSlot,
  validate,
  bookingController.moveLessonSlot
);

module.exports = router;
