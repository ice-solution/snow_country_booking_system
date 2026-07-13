const { body, param, query } = require('express-validator');
const Booking = require('../models/Booking');
const { isValidResortId } = require('./catalogChecks');
const { normalizeLessonDate } = require('../utils/lessonDateRange');

function validateWebsiteDateRange(body) {
  const fromInput = body.lessonDateFrom || body.lessonDate;
  const toInput = body.lessonDateTo || body.lessonDateFrom || body.lessonDate;
  if (!fromInput) throw new Error('lessonDateFrom is required');
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
      .custom((v) => Booking.DURATION_HOURS.includes(Number(v)))
      .withMessage('時數必須為 3、4、5 或 6')
      .toInt(),
    body('totalGuests').isInt({ min: 1 }),
    body('childrenUnder6').optional().isInt({ min: 0 }),
    body('lessonDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonDateFrom').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonDateTo').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  ],
  submit: [
    body('lessonDateFrom').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonDateTo').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('lessonDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body().custom(validateWebsiteDateRange),
    body('resortLocation')
      .custom(async (v) => isValidResortId(v))
      .withMessage('Please select a resort'),
    body('durationHours')
      .custom((v) => Booking.DURATION_HOURS.includes(Number(v)))
      .withMessage('時數必須為 3、4、5 或 6')
      .toInt(),
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
