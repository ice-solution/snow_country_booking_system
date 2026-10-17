const crypto = require('crypto');
const Booking = require('../models/Booking');
const { calculateInstructorsRequired } = require('../utils/instructorRequirement');
const catalogService = require('./catalogService');
const pricingConfigService = require('./pricingConfigService');
const { createCheckoutSession, isStripeEnabled } = require('./stripeService');
const {
  parseLessonDateRange,
  getLessonSlots,
  getLessonDayCount,
  toIsoDate,
} = require('../utils/lessonDateRange');

function generatePublicRef() {
  return crypto.randomBytes(16).toString('hex');
}

async function calculateSlotsTotal(resortLocation, slots, instructorsRequired) {
  let total = 0;
  let packagePrice = null;
  let currency = null;
  let regionName = null;
  let resortName = null;
  let region = null;

  for (const slot of slots) {
    const pricing = await pricingConfigService.calculatePrice(
      resortLocation,
      slot.durationHours,
      instructorsRequired
    );
    total += pricing.totalAmount;
    packagePrice = packagePrice ?? pricing.packagePrice;
    currency = pricing.currency;
    regionName = pricing.regionName;
    resortName = pricing.resortName;
    region = pricing.region;
  }

  return {
    totalAmount: total,
    packagePrice,
    currency,
    regionName,
    resortName,
    region,
    packageTotal: packagePrice != null ? packagePrice * instructorsRequired : null,
  };
}

async function buildWebsiteBookingPayload(body) {
  const totalGuests = Number(body.totalGuests);
  const childrenUnder6 = Number(body.childrenUnder6 || 0);
  const instructorsRequired = calculateInstructorsRequired(totalGuests, childrenUnder6);
  const dateRange = parseLessonDateRange(body);
  const slots = dateRange.lessonSlots || getLessonSlots(dateRange);
  const durationHours = Number(body.durationHours || dateRange.durationHours || slots[0]?.durationHours);
  const pricing = await calculateSlotsTotal(body.resortLocation, slots, instructorsRequired);

  const payload = catalogService.applyResortToBooking({
    source: 'website',
    status: 'pending',
    lessonDateFrom: dateRange.lessonDateFrom,
    lessonDateTo: dateRange.lessonDateTo,
    lessonDate: dateRange.lessonDate,
    durationHours,
    lessonStartTime: dateRange.lessonStartTime || slots[0]?.startTime,
    resortLocation: body.resortLocation,
    lessonType: body.lessonType,
    totalGuests,
    childrenUnder6,
    instructorsRequired,
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
    totalAmount: pricing.totalAmount,
    currency: pricing.currency,
    publicRef: generatePublicRef(),
  });

  if (dateRange.lessonSlots) {
    payload.lessonSlots = dateRange.lessonSlots;
  }

  return payload;
}

function sanitizePublicBooking(booking) {
  const slots = getLessonSlots(booking).map((s) => ({
    date: s.date,
    startTime: s.startTime,
    durationHours: s.durationHours,
  }));
  return {
    id: booking._id,
    status: booking.status,
    lessonDateFrom: booking.lessonDateFrom,
    lessonDateTo: booking.lessonDateTo,
    lessonDate: booking.lessonDateFrom,
    lessonSlots: slots,
    lessonDayCount: getLessonDayCount(booking),
    durationHours: booking.durationHours,
    lessonStartTime: booking.lessonStartTime,
    region: booking.region,
    resortLocation: booking.resortLocation,
    lessonType: booking.lessonType,
    totalGuests: booking.totalGuests,
    childrenUnder6: booking.childrenUnder6,
    instructorsRequired: booking.instructorsRequired,
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
  lessonSlots,
}) {
  const instructorsRequired = calculateInstructorsRequired(
    Number(totalGuests),
    Number(childrenUnder6 || 0)
  );

  let slots;
  try {
    const range = parseLessonDateRange({
      lessonSlots,
      lessonDate,
      lessonDateFrom,
      lessonDateTo,
      durationHours,
    });
    slots = range.lessonSlots || getLessonSlots({
      ...range,
      durationHours: Number(durationHours || range.durationHours),
      lessonStartTime: range.lessonStartTime,
    });
  } catch {
    if (!durationHours) {
      return {
        instructorsRequired,
        totalGuests: Number(totalGuests),
        stripeEnabled: isStripeEnabled(),
      };
    }
    const pricing = await pricingConfigService.calculatePrice(
      resortLocation,
      Number(durationHours),
      instructorsRequired
    );
    return {
      instructorsRequired,
      ...pricing,
      packageTotal: pricing.totalAmount,
      totalAmount: pricing.totalAmount,
      lessonDayCount: 1,
      totalGuests: Number(totalGuests),
      stripeEnabled: isStripeEnabled(),
      capacity: null,
    };
  }

  if (!slots.length && durationHours) {
    slots = [{ durationHours: Number(durationHours), startTime: '09:00', date: new Date() }];
  }

  const pricing = await calculateSlotsTotal(resortLocation, slots, instructorsRequired);
  const dayCount = slots.length;

  let capacity = null;
  if (slots.length) {
    const { getDailyCapacity } = require('./capacityService');
    const capacities = [];
    const seenDays = new Set();
    for (const slot of slots) {
      const key = toIsoDate(slot.date);
      if (seenDays.has(key)) continue;
      seenDays.add(key);
      capacities.push(await getDailyCapacity(slot.date));
    }
    const priority = { overbooked: 3, tight: 2, ok: 1 };
    capacity = capacities.reduce(
      (worst, cap) => (priority[cap.status] > priority[worst.status] ? cap : worst),
      capacities[0]
    );
  }

  const primaryDuration = Number(durationHours || slots[0]?.durationHours);
  return {
    instructorsRequired,
    packagePrice: pricing.packagePrice,
    currency: pricing.currency,
    region: pricing.region,
    regionName: pricing.regionName,
    resortName: pricing.resortName,
    resortLocation,
    durationHours: primaryDuration,
    packageTotal: pricing.packageTotal,
    totalAmount: pricing.totalAmount,
    lessonDayCount: dayCount,
    totalGuests: Number(totalGuests),
    stripeEnabled: isStripeEnabled(),
    capacity,
    lessonSlots: slots.map((s) => ({
      date: s.date,
      startTime: s.startTime,
      durationHours: s.durationHours,
    })),
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
