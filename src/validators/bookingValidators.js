const { body, param, query } = require('express-validator');
const Booking = require('../models/Booking');
const { isValidResortId, isValidRegionId } = require('./catalogChecks');
const { normalizeLessonDate } = require('../utils/lessonDateRange');

function validateDateRange(body) {
  const fromInput = body.lessonDateFrom || body.lessonDate;
  const toInput = body.lessonDateTo || body.lessonDateFrom || body.lessonDate;
  if (!fromInput) throw new Error('lessonDateFrom is required');
  const from = normalizeLessonDate(fromInput);
  const to = normalizeLessonDate(toInput);
  if (to < from) throw new Error('lessonDateTo must be on or after lessonDateFrom');
  return true;
}

const bookingValidators = {
  create: [
    body('lessonDateFrom').optional().isISO8601(),
    body('lessonDateTo').optional().isISO8601(),
    body('lessonDate').optional().isISO8601(),
    body().custom(validateDateRange),
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
    body('lessonDateFrom').optional().isISO8601(),
    body('lessonDateTo').optional().isISO8601(),
    body('lessonDate').optional().isISO8601(),
    body().custom((value, { req }) => {
      const hasDate =
        req.body.lessonDateFrom || req.body.lessonDateTo || req.body.lessonDate;
      if (!hasDate && req.method === 'PUT') return true;
      return validateDateRange(req.body);
    }),
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
    body('instructorIds').optional().isArray({ min: 1 }),
    body('instructorIds.*').optional().isMongoId(),
    body('coachIds').optional().isArray({ min: 1 }),
    body('coachIds.*').optional().isMongoId(),
    body('assignedBy').optional().trim(),
  ],
  moveSlot: [
    param('id').isMongoId(),
    body('toDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('toDate must be YYYY-MM-DD'),
    body('toStartTime').optional().matches(/^\d{2}:\d{2}$/),
    body('toDurationHours')
      .optional()
      .custom((v) => Booking.DURATION_HOURS.includes(Number(v))),
    body('slotIndex').optional().isInt({ min: 0 }),
    body('fromDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('fromStartTime').optional().matches(/^\d{2}:\d{2}$/),
    body('fromInstructorId').optional().isMongoId(),
    body('toInstructorId').optional().isMongoId(),
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
