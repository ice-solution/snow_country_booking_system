const crypto = require('crypto');
const Booking = require('../models/Booking');
const { calculateCoachesRequired } = require('../utils/coachRequirement');
const catalogService = require('../services/catalogService');
const pricingConfigService = require('../services/pricingConfigService');
const { createCheckoutSession, isStripeEnabled } = require('./stripeService');
const {
  parseLessonDateRange,
  getLessonDays,
  toIsoDate,
} = require('../utils/lessonDateRange');

function generatePublicRef() {
  return crypto.randomBytes(16).toString('hex');
}

async function buildWebsiteBookingPayload(body) {
  const totalGuests = Number(body.totalGuests);
  const childrenUnder6 = Number(body.childrenUnder6 || 0);
  const durationHours = Number(body.durationHours);
  const coachesRequired = calculateCoachesRequired(totalGuests, childrenUnder6);
  const dateRange = parseLessonDateRange(body);
  const pricing = await pricingConfigService.calculatePrice(
    body.resortLocation,
    durationHours,
    coachesRequired
  );

  return catalogService.applyResortToBooking({
    source: 'website',
    status: 'pending',
    ...dateRange,
    durationHours,
    resortLocation: body.resortLocation,
    lessonType: body.lessonType,
    totalGuests,
    childrenUnder6,
    coachesRequired,
    guestName: body.guestName.trim(),
    phone: body.phone.trim(),
    email: body.email?.trim().toLowerCase(),
    instagram: body.instagram?.trim(),
    facebook: body.facebook?.trim(),
    whatsapp: body.whatsapp?.trim(),
    line: body.line?.trim(),
    wechat: body.wechat?.trim(),
    languagePref: body.languagePref || 'any',
    specialRequests: body.specialRequests?.trim(),
    paymentMethod: body.paymentMethod,
    totalAmount: pricing.totalAmount * dateRange.lessonDayCount,
    currency: pricing.currency,
    publicRef: generatePublicRef(),
  });
}

function sanitizePublicBooking(booking) {
  return {
    id: booking._id,
    status: booking.status,
    lessonDateFrom: booking.lessonDateFrom,
    lessonDateTo: booking.lessonDateTo,
    lessonDate: booking.lessonDateFrom,
    lessonDayCount: getLessonDays(booking).length,
    durationHours: booking.durationHours,
    region: booking.region,
    resortLocation: booking.resortLocation,
    lessonType: booking.lessonType,
    totalGuests: booking.totalGuests,
    childrenUnder6: booking.childrenUnder6,
    coachesRequired: booking.coachesRequired,
    guestName: booking.guestName,
    phone: booking.phone,
    email: booking.email,
    languagePref: booking.languagePref,
    specialRequests: booking.specialRequests,
    paymentMethod: booking.paymentMethod,
    paymentStatus: booking.paymentStatus,
    totalAmount: booking.totalAmount,
    currency: booking.currency,
    createdAt: booking.createdAt,
  };
}

async function getQuote({
  resortLocation,
  durationHours,
  totalGuests,
  childrenUnder6,
  lessonDate,
  lessonDateFrom,
  lessonDateTo,
}) {
  const coachesRequired = calculateCoachesRequired(
    Number(totalGuests),
    Number(childrenUnder6 || 0)
  );
  const pricing = await pricingConfigService.calculatePrice(
    resortLocation,
    Number(durationHours),
    coachesRequired
  );

  let dayCount = 1;
  let capacity = null;
  const fromInput = lessonDateFrom || lessonDate;
  const toInput = lessonDateTo || lessonDateFrom || lessonDate;

  if (fromInput) {
    const range = parseLessonDateRange({
      lessonDateFrom: fromInput,
      lessonDateTo: toInput,
    });
    dayCount = range.lessonDayCount;

    const { getDailyCapacity } = require('./capacityService');
    const capacities = [];
    for (const day of getLessonDays(range)) {
      capacities.push(await getDailyCapacity(day));
    }
    const priority = { overbooked: 3, tight: 2, ok: 1 };
    capacity = capacities.reduce(
      (worst, cap) => (priority[cap.status] > priority[worst.status] ? cap : worst),
      capacities[0]
    );
  }

  return {
    coachesRequired,
    ...pricing,
    packageTotal: pricing.totalAmount,
    totalAmount: pricing.totalAmount * dayCount,
    lessonDayCount: dayCount,
    totalGuests: Number(totalGuests),
    stripeEnabled: isStripeEnabled(),
    capacity,
  };
}

async function submitWebsiteBooking(body, req) {
  const payload = await buildWebsiteBookingPayload(body);

  if (payload.paymentMethod === 'stripe') {
    if (!payload.email) {
      const error = new Error('線上付款需要提供 Email');
      error.status = 400;
      throw error;
    }
    if (!isStripeEnabled()) {
      const error = new Error('線上付款暫時不可用，請選擇現場付款');
      error.status = 503;
      throw error;
    }
    payload.paymentStatus = 'unpaid';
  } else {
    payload.paymentMethod = 'on_site';
    payload.paymentStatus = 'pay_on_site';
  }

  const booking = await Booking.create(payload);

  if (payload.paymentMethod === 'stripe') {
    const session = await createCheckoutSession(booking, req);
    booking.stripeSessionId = session.id;
    await booking.save();

    return {
      booking: sanitizePublicBooking(booking),
      checkoutUrl: session.url,
      publicRef: booking.publicRef,
    };
  }

  return {
    booking: sanitizePublicBooking(booking),
    publicRef: booking.publicRef,
  };
}

async function getPublicBooking(id, ref) {
  const booking = await Booking.findById(id);
  if (!booking || booking.publicRef !== ref) {
    const error = new Error('找不到預約');
    error.status = 404;
    throw error;
  }
  return sanitizePublicBooking(booking);
}

async function handleCheckoutCompleted(session) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return null;

  const booking = await Booking.findById(bookingId);
  if (!booking) return null;

  if (booking.paymentStatus === 'paid_online') return booking;

  booking.paymentStatus = 'paid_online';
  booking.stripeSessionId = session.id;
  await booking.save();

  return booking;
}

module.exports = {
  getQuote,
  submitWebsiteBooking,
  getPublicBooking,
  handleCheckoutCompleted,
  sanitizePublicBooking,
};
