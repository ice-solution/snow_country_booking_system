const { body } = require('express-validator');
const Booking = require('../models/Booking');
const { isValidResortId } = require('./catalogChecks');
const { normalizeLessonDate } = require('../utils/lessonDateRange');

const ALLOWED_SOURCES = ['klook', 'whatsapp', 'line', 'webchat'];

function validateIntegrationDateRange(body) {
  const fromInput = body.lessonDateFrom || body.lessonDate;
  const toInput = body.lessonDateTo || body.lessonDateFrom || body.lessonDate;
  if (!fromInput) throw new Error('lessonDateFrom is required');
  const from = normalizeLessonDate(fromInput);
  const to = normalizeLessonDate(toInput);
  if (to < from) throw new Error('lessonDateTo must be on or after lessonDateFrom');
  return true;
}

const integrationValidators = {
  createBooking: [
    body('source').isIn(ALLOWED_SOURCES),
    body('lessonDateFrom').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonDateTo').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body().custom(validateIntegrationDateRange),
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
    body('whatsapp').optional().trim(),
    body('line').optional().trim(),
    body('languagePref').optional().isIn(Booking.LANGUAGE_PREFS),
    body('specialRequests').optional().trim(),
    body('klookOrderId').optional().trim(),
    body('adminNotes').optional().trim(),
  ],
};

module.exports = integrationValidators;
