const { body, param, query } = require('express-validator');
const Booking = require('../models/Booking');
const { isValidResortId, isValidRegionId } = require('./catalogChecks');

const bookingValidators = {
  create: [
    body('lessonDate').isISO8601().withMessage('Please provide a valid lesson date'),
    body('durationHours')
      .custom((v) => Booking.DURATION_HOURS.includes(Number(v)))
      .withMessage('Duration must be 3, 4, 5, or 6 hours')
      .toInt(),
    body('resortLocation')
      .custom(async (v) => isValidResortId(v))
      .withMessage('Invalid resort'),
    body('region')
      .optional()
      .custom(async (v) => isValidRegionId(v))
      .withMessage('Invalid region'),
    body('lessonType').isIn(Booking.LESSON_TYPES),
    body('totalGuests').isInt({ min: 1 }),
    body('childrenUnder6').optional().isInt({ min: 0 }),
    body('guestName').trim().notEmpty(),
    body('phone').trim().notEmpty(),
    body('email').optional().isEmail(),
    body('instagram').optional().trim(),
    body('facebook').optional().trim(),
    body('whatsapp').optional().trim(),
    body('line').optional().trim(),
    body('wechat').optional().trim(),
    body('languagePref').optional().isIn(Booking.LANGUAGE_PREFS),
    body('source').optional().isIn(Booking.BOOKING_SOURCES),
    body('paymentMethod').optional().isIn(Booking.PAYMENT_METHODS),
    body('paymentStatus').optional().isIn(Booking.PAYMENT_STATUSES),
    body('lessonStartTime').optional().trim(),
  ],
  update: [
    param('id').isMongoId(),
    body('lessonDate').optional().isISO8601(),
    body('durationHours')
      .optional()
      .custom((v) => Booking.DURATION_HOURS.includes(Number(v)))
      .toInt(),
    body('region')
      .optional()
      .custom(async (v) => isValidRegionId(v))
      .withMessage('Invalid region'),
    body('resortLocation')
      .optional()
      .custom(async (v) => isValidResortId(v))
      .withMessage('Invalid resort'),
    body('lessonType').optional().isIn(Booking.LESSON_TYPES),
    body('totalGuests').optional().isInt({ min: 1 }),
    body('childrenUnder6').optional().isInt({ min: 0 }),
    body('lessonStartTime').optional().trim(),
    body('instagram').optional().trim(),
    body('facebook').optional().trim(),
    body('whatsapp').optional().trim(),
    body('line').optional().trim(),
    body('wechat').optional().trim(),
    body('adminNotes').optional().trim(),
    body('paymentStatus').optional().isIn(Booking.PAYMENT_STATUSES),
  ],
  assign: [
    param('id').isMongoId(),
    body('coachIds').isArray({ min: 1 }),
    body('coachIds.*').isMongoId(),
    body('assignedBy').optional().trim(),
  ],
  calculate: [
    body('totalGuests').isInt({ min: 1 }),
    body('childrenUnder6').optional().isInt({ min: 0 }),
  ],
  list: [
    query('status').optional().isIn(Booking.BOOKING_STATUSES),
    query('source').optional().isIn(Booking.BOOKING_SOURCES),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
};

module.exports = bookingValidators;
