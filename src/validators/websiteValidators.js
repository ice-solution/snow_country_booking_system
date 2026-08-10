const { body, param, query } = require('express-validator');
const Booking = require('../models/Booking');
const { isValidResortId } = require('./catalogChecks');
const { normalizeLessonDate } = require('../utils/lessonDateRange');

function validateWebsiteDateRange(value, { req }) {
  const bodyData = req.body || {};
  if (Array.isArray(bodyData.lessonSlots) && bodyData.lessonSlots.length) {
    for (const slot of bodyData.lessonSlots) {
      if (!slot?.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(slot.date))) {
        throw new Error('Each timeslot needs a valid date (YYYY-MM-DD)');
      }
      if (!Booking.DURATION_HOURS.includes(Number(slot.durationHours))) {
        throw new Error('Timeslot duration must be 3, 4, 5 or 6 hours');
      }
      if (slot.startTime && !/^\d{2}:\d{2}$/.test(String(slot.startTime))) {
        throw new Error('Timeslot start time must be HH:MM');
      }
    }
    return true;
  }

  const fromInput = bodyData.lessonDateFrom || bodyData.lessonDate;
  const toInput = bodyData.lessonDateTo || bodyData.lessonDateFrom || bodyData.lessonDate;
  if (!fromInput) throw new Error('Please add at least one lesson timeslot');
  const from = normalizeLessonDate(fromInput);
  const to = normalizeLessonDate(toInput);
  if (to < from) throw new Error('lessonDateTo must be on or after lessonDateFrom');
  return true;
}

const websiteValidators = {
  quote: [
    body('resortLocation')
      .custom(async (v) => isValidResortId(v))
      .withMessage('Please select a resort'),
    body('durationHours')
      .optional()
      .custom((v) => Booking.DURATION_HOURS.includes(Number(v)))
      .withMessage('時數必須為 3、4、5 或 6')
      .toInt(),
    body('totalGuests').isInt({ min: 1 }),
    body('childrenUnder6').optional().isInt({ min: 0 }),
    body('lessonDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonDateFrom').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonDateTo').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonSlots').optional().isArray(),
  ],
  submit: [
    body('lessonSlots').optional().isArray({ min: 1 }),
    body('lessonDateFrom').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonDateTo').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body().custom(validateWebsiteDateRange),
    body('resortLocation')
      .custom(async (v) => isValidResortId(v))
      .withMessage('Please select a resort'),
    body('durationHours')
      .optional()
      .custom((v) => !v || Booking.DURATION_HOURS.includes(Number(v)))
      .withMessage('時數必須為 3、4、5 或 6'),
    body('lessonType').isIn(Booking.LESSON_TYPES),
    body('totalGuests').isInt({ min: 1 }),
    body('childrenUnder6').optional().isInt({ min: 0 }),
    body('guestName').trim().notEmpty().withMessage('請填寫聯絡人姓名'),
    body('phone').trim().notEmpty().withMessage('請填寫電話'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('請填寫有效 Email'),
    body('languagePref').optional().isIn(Booking.LANGUAGE_PREFS),
    body('specialRequests').optional().trim(),
    body('instagram').optional().trim(),
    body('facebook').optional().trim(),
    body('whatsapp').optional().trim(),
    body('line').optional().trim(),
    body('wechat').optional().trim(),
    body('paymentMethod').isIn(Booking.PAYMENT_METHODS).withMessage('請選擇付款方式'),
  ],
  publicBooking: [
    param('id').isMongoId(),
    query('ref').notEmpty().withMessage('缺少查詢參考碼'),
  ],
};

module.exports = websiteValidators;
