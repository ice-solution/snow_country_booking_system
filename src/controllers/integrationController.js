const Booking = require('../models/Booking');
const { calculateCoachesRequired } = require('../utils/coachRequirement');
const catalogService = require('../services/catalogService');
const pricingConfigService = require('../services/pricingConfigService');
const { createBookingFromKlookEmail, parseKlookEmail } = require('../services/klookImportService');
const { generateTimeSlots } = require('../config/gantt');

function normalizeLessonDate(dateInput) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

const ALLOWED_SOURCES = ['klook', 'whatsapp', 'line', 'webchat'];

async function buildIntegrationPayload(body) {
  const totalGuests = Number(body.totalGuests);
  const childrenUnder6 = Number(body.childrenUnder6 || 0);
  const durationHours = Number(body.durationHours);
  const coachesRequired = calculateCoachesRequired(totalGuests, childrenUnder6);

  const payload = {
    source: body.source,
    status: 'pending',
    lessonDate: normalizeLessonDate(body.lessonDate),
    durationHours,
    region: body.region,
    resortLocation: body.resortLocation,
    lessonType: body.lessonType,
    totalGuests,
    childrenUnder6,
    coachesRequired,
    guestName: body.guestName.trim(),
    phone: body.phone.trim(),
    email: body.email?.trim().toLowerCase(),
    languagePref: body.languagePref || 'any',
    specialRequests: body.specialRequests?.trim(),
    paymentMethod: body.paymentMethod || 'on_site',
    paymentStatus: body.paymentStatus || 'pay_on_site',
    klookOrderId: body.klookOrderId?.trim(),
    lessonStartTime: body.lessonStartTime?.trim(),
    adminNotes: body.adminNotes?.trim(),
  };

  if (body.resortLocation && durationHours) {
    const pricing = await pricingConfigService.calculatePrice(
      body.resortLocation,
      durationHours,
      coachesRequired
    );
    payload.totalAmount = pricing.totalAmount;
    payload.currency = pricing.currency;
  }

  return payload;
}

async function createIntegrationBooking(req, res, next) {
  try {
    if (!ALLOWED_SOURCES.includes(req.body.source)) {
      return res.status(400).json({
        success: false,
        message: `source must be one of: ${ALLOWED_SOURCES.join(', ')}`,
      });
    }

    const payload = await catalogService.applyResortToBooking(await buildIntegrationPayload(req.body));
    const booking = await Booking.create(payload);

    res.status(201).json({
      success: true,
      data: {
        id: booking._id,
        status: booking.status,
        coachesRequired: booking.coachesRequired,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        lessonDate: booking.lessonDate,
        guestName: booking.guestName,
        source: booking.source,
      },
      message: 'Booking created — status pending review',
    });
  } catch (err) {
    next(err);
  }
}

async function parseKlookEmailPreview(req, res, next) {
  try {
    const result = parseKlookEmail(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function importKlookEmail(req, res, next) {
  try {
    const result = await createBookingFromKlookEmail(req.body);
    const status = result.duplicate ? 200 : 201;
    res.status(status).json({
      success: true,
      duplicate: result.duplicate,
      data: {
        booking: result.booking,
        parseResult: result.parseResult,
      },
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

async function getIntegrationMeta(req, res) {
  res.json({
    success: true,
    data: {
      endpoints: {
        createBooking: 'POST /api/v1/integrations/bookings',
        parseKlookEmail: 'POST /api/v1/integrations/klook/parse',
        importKlookEmail: 'POST /api/v1/integrations/klook/import',
        websiteQuote: 'POST /api/v1/website/quote',
        websiteSubmit: 'POST /api/v1/website/submit',
      },
      allowedSources: ALLOWED_SOURCES,
      resorts: getResortsConfig(),
      locations: getResortsConfig(),
      gantt: {
        slotMinutes: 30,
        timeSlots: generateTimeSlots().map((s) => s.time),
      },
      n8n: {
        klookWorkflow: [
          '1. Email Trigger (subject contains "Klook Order Received")',
          '2. HTTP Request POST /api/v1/integrations/klook/import',
          '   Body: { "subject": "{{$json.subject}}", "html": "{{$json.html}}", "text": "{{$json.text}}" }',
          '   Header: X-API-Key',
          '3. IF duplicate → notify admin, ELSE → notify new booking',
        ],
        chatbotWorkflow: [
          '1. WhatsApp/LINE/Webhook Trigger',
          '2. AI Agent collects: date, duration, resort, lessonType, guests, name, phone',
          '3. POST /api/v1/website/quote → show price',
          '4. POST /api/v1/integrations/bookings with source whatsapp|line|webchat',
        ],
      },
    },
  });
}

module.exports = {
  createIntegrationBooking,
  parseKlookEmailPreview,
  importKlookEmail,
  getIntegrationMeta,
  ALLOWED_SOURCES,
};
