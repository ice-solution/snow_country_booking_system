const Booking = require('../models/Booking');
const { calculateCoachesRequired } = require('../utils/coachRequirement');
const catalogService = require('../services/catalogService');
const pricingConfigService = require('../services/pricingConfigService');
const assignmentService = require('../services/assignmentService');
const { getGuestSummaryById } = require('../services/guestSummaryService');

function normalizeLessonDate(dateInput) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function buildBookingPayload(body) {
  const totalGuests = Number(body.totalGuests);
  const childrenUnder6 = Number(body.childrenUnder6 || 0);
  const coachesRequired = calculateCoachesRequired(totalGuests, childrenUnder6);

  const payload = {
    ...body,
    lessonDate: normalizeLessonDate(body.lessonDate),
    totalGuests,
    childrenUnder6,
    coachesRequired,
  };

  if (body.resortLocation && body.durationHours) {
    const pricing = await pricingConfigService.calculatePrice(
      body.resortLocation,
      Number(body.durationHours),
      coachesRequired
    );
    payload.totalAmount = pricing.totalAmount;
    payload.currency = pricing.currency;
    if (!payload.region) payload.region = pricing.region;
  }

  return body.resortLocation ? catalogService.applyResortToBooking(payload) : payload;
}

async function listBookings(req, res, next) {
  try {
    const { status, from, to, source } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (source) filter.source = source;
    if (from || to) {
      filter.lessonDate = {};
      if (from) filter.lessonDate.$gte = normalizeLessonDate(from);
      if (to) {
        const end = normalizeLessonDate(to);
        end.setHours(23, 59, 59, 999);
        filter.lessonDate.$lte = end;
      }
    }

    const bookings = await Booking.find(filter)
      .populate('assignedCoaches.coach', 'name phone specialties')
      .sort({ lessonDate: 1, createdAt: -1 });

    res.json({ success: true, data: bookings });
  } catch (err) {
    next(err);
  }
}

async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).populate(
      'assignedCoaches.coach',
      'name phone email specialties languages'
    );
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

async function getBookingGuest(req, res, next) {
  try {
    const data = await getGuestSummaryById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createBooking(req, res, next) {
  try {
    const payload = await buildBookingPayload(req.body);
    const booking = await Booking.create(payload);
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

const ASSIGNED_EDITABLE_FIELDS = new Set([
  'lessonStartTime',
  'adminNotes',
  'paymentStatus',
  'resortLocation',
]);

function pickEditableFields(body, allowedFields) {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.has(key) && body[key] !== undefined)
  );
}

async function updateBooking(req, res, next) {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['completed', 'cancelled'].includes(existing.status)) {
      return res.status(400).json({
        success: false,
        message: 'Completed or cancelled bookings cannot be edited',
      });
    }

    let updateBody = req.body;
    if (existing.status === 'assigned') {
      updateBody = pickEditableFields(req.body, ASSIGNED_EDITABLE_FIELDS);
      if (!Object.keys(updateBody).length) {
        return res.status(400).json({
          success: false,
          message: 'Assigned bookings can only update start time, resort, notes, or payment status',
        });
      }
    }

    const merged = { ...existing.toObject(), ...updateBody };
    const payload = await buildBookingPayload(merged);
    delete payload._id;
    delete payload.createdAt;
    delete payload.updatedAt;

    const booking = await Booking.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

async function confirmBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be confirmed',
      });
    }

    booking.status = 'confirmed';
    booking.confirmedAt = new Date();
    booking.confirmedBy = req.body.confirmedBy || 'admin';
    if (req.body.adminNotes) booking.adminNotes = req.body.adminNotes;

    await booking.save();
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled', adminNotes: req.body.adminNotes },
      { new: true }
    );
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

async function markNeedsAttention(req, res, next) {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        status: 'needs_attention',
        adminNotes: req.body.adminNotes || 'Needs admin attention',
      },
      { new: true }
    );
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

async function suggestCoaches(req, res, next) {
  try {
    const forReassign = req.query.forReassign === 'true' || req.query.forReassign === '1';
    const result = await assignmentService.suggestCoachesForBooking(req.params.id, {
      forReassign,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function assignCoaches(req, res, next) {
  try {
    const { coachIds, assignedBy } = req.body;
    const booking = await assignmentService.assignCoaches(
      req.params.id,
      coachIds,
      assignedBy || 'manual'
    );
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

async function reassignCoaches(req, res, next) {
  try {
    const { coachIds, assignedBy } = req.body;
    const booking = await assignmentService.reassignCoaches(
      req.params.id,
      coachIds,
      assignedBy || 'manual'
    );
    res.json({ success: true, data: booking, message: 'Coach assignment updated' });
  } catch (err) {
    next(err);
  }
}

async function resolveBooking(req, res, next) {
  try {
    const booking = await assignmentService.resolveBooking(req.params.id, {
      adminNotes: req.body.adminNotes,
    });
    res.json({
      success: true,
      data: booking,
      message: 'Booking resolved — ready to assign coaches',
    });
  } catch (err) {
    next(err);
  }
}

async function completeBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!['assigned', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed or assigned bookings can be marked complete',
      });
    }

    booking.status = 'completed';
    if (req.body.adminNotes) booking.adminNotes = req.body.adminNotes;
    await booking.save();

    res.json({ success: true, data: booking, message: 'Lesson marked complete' });
  } catch (err) {
    next(err);
  }
}

async function calculateCoaches(req, res) {
  const { totalGuests, childrenUnder6 } = req.body;
  const coachesRequired = calculateCoachesRequired(
    Number(totalGuests),
    Number(childrenUnder6 || 0)
  );
  res.json({ success: true, data: { coachesRequired } });
}

async function autoAssignCoaches(req, res, next) {
  try {
    const booking = await assignmentService.autoAssignCoaches(req.params.id);
    res.json({ success: true, data: booking, message: 'Coaches assigned automatically' });
  } catch (err) {
    next(err);
  }
}

async function autoReassignCoaches(req, res, next) {
  try {
    const booking = await assignmentService.autoReassignCoaches(req.params.id);
    res.json({ success: true, data: booking, message: 'Coaches reassigned automatically' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBookings,
  getBooking,
  getBookingGuest,
  createBooking,
  updateBooking,
  confirmBooking,
  cancelBooking,
  markNeedsAttention,
  resolveBooking,
  suggestCoaches,
  assignCoaches,
  reassignCoaches,
  autoAssignCoaches,
  autoReassignCoaches,
  calculateCoaches,
  completeBooking,
};
