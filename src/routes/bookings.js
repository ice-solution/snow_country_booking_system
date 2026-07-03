const express = require('express');
const bookingController = require('../controllers/bookingController');
const bookingValidators = require('../validators/bookingValidators');
const validate = require('../middleware/validate');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

// 公開 API：客人建立預約、計算教練數
router.post(
  '/calculate-coaches',
  bookingValidators.calculate,
  validate,
  bookingController.calculateCoaches
);

router.post('/', bookingValidators.create, validate, bookingController.createBooking);

// 管理員 API
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
router.get('/:id/suggest-coaches', requireAdminKey, bookingController.suggestCoaches);
router.post(
  '/:id/assign',
  requireAdminKey,
  bookingValidators.assign,
  validate,
  bookingController.assignCoaches
);
router.post(
  '/:id/reassign',
  requireAdminKey,
  bookingValidators.assign,
  validate,
  bookingController.reassignCoaches
);
router.post('/:id/auto-assign', requireAdminKey, bookingController.autoAssignCoaches);
router.post('/:id/auto-reassign', requireAdminKey, bookingController.autoReassignCoaches);

module.exports = router;
