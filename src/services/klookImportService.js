const Booking = require('../models/Booking');
const { parseKlookEmail } = require('./klookEmailParser');
const { calculateInstructorsRequired } = require('../utils/instructorRequirement');
const catalogService = require('../services/catalogService');
const pricingConfigService = require('../services/pricingConfigService');
const crypto = require('crypto');

function normalizeLessonDate(dateInput) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function createBookingFromKlookEmail(input) {
  const result = parseKlookEmail(input);
  const { parsed, missing, needsReview } = result;

  if (!parsed.klookOrderId) {
    const error = new Error('Could not parse Klook order ID');
    error.status = 400;
    throw error;
  }

  if (!parsed.lessonDate) {
    const error = new Error('Could not parse lesson date');
    error.status = 400;
    throw error;
  }

  const existing = await Booking.findOne({ klookOrderId: parsed.klookOrderId });
  if (existing) {
    return {
      duplicate: true,
      booking: existing,
      parseResult: result,
      message: `Order ${parsed.klookOrderId} already exists`,
    };
  }

  const instructorsRequired = calculateInstructorsRequired(parsed.totalGuests, parsed.childrenUnder6);
  const pricing = await pricingConfigService.calculatePrice(
    parsed.resortLocation,
    parsed.durationHours,
    instructorsRequired
  );

  const lessonDate = normalizeLessonDate(parsed.lessonDate);
  const booking = await Booking.create(
    await catalogService.applyResortToBooking({
      ...parsed,
      lessonDateFrom: lessonDate,
      lessonDateTo: lessonDate,
      lessonDate,
      instructorsRequired,
      totalAmount: pricing.totalAmount,
      currency: pricing.currency,
      status: 'pending',
      adminNotes: needsReview
        ? `Klook auto-import (missing fields: ${missing.join(', ')})`
        : 'Klook auto-import',
      publicRef: crypto.randomBytes(16).toString('hex'),
    })
  );

  return {
    duplicate: false,
    booking,
    parseResult: result,
    message: needsReview
      ? 'Booking created — some fields need admin review'
      : 'Klook booking created successfully',
  };
}

module.exports = { createBookingFromKlookEmail, parseKlookEmail };
