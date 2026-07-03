const { body } = require('express-validator');
const Booking = require('../models/Booking');
const { isValidResortId } = require('./catalogChecks');

const ALLOWED_SOURCES = ['klook', 'whatsapp', 'line', 'webchat'];

const integrationValidators = {
  createBooking: [
    body('source').isIn(ALLOWED_SOURCES),
    body('lessonDate')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Valid lesson date required (YYYY-MM-DD)'),
    body('resortLocation')
      .custom(async (v) => isValidResortId(v))
      .withMessage('Invalid resort'),
    body('durationHours')
      .custom((v) => Booking.DURATION_HOURS.includes(Number(v)))
      .toInt(),
    body('lessonType').isIn(Booking.LESSON_TYPES),
    body('totalGuests').isInt({ min: 1 }),
    body('childrenUnder6').optional().isInt({ min: 0 }),
    body('guestName').trim().notEmpty(),
    body('phone').trim().notEmpty(),
    body('email').optional({ values: 'falsy' }).isEmail(),
    body('languagePref').optional().isIn(Booking.LANGUAGE_PREFS),
    body('specialRequests').optional().trim(),
    body('klookOrderId').optional().trim(),
    body('adminNotes').optional().trim(),
  ],
};

module.exports = integrationValidators;
