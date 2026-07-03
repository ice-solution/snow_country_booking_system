const Booking = require('../models/Booking');
const Coach = require('../models/Coach');
const { isCoachBlockedForBooking } = require('../utils/leavePeriods');

function normalizeDate(dateInput) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameDay(a, b) {
  const d1 = normalizeDate(a);
  const d2 = normalizeDate(b);
  return d1.getTime() === d2.getTime();
}

async function getCoachLeaveConflicts() {
  const coaches = await Coach.find({ active: true, 'blockedDates.0': { $exists: true } });
  const alerts = [];

  for (const coach of coaches) {
    for (const block of coach.blockedDates) {
      const bookings = await Booking.find({
        status: { $in: ['assigned', 'confirmed'] },
        lessonDate: {
          $gte: normalizeDate(block.date),
          $lt: new Date(normalizeDate(block.date).getTime() + 86400000),
        },
        'assignedCoaches.coach': coach._id,
      }).select('guestName lessonDate durationHours status phone');

      for (const booking of bookings) {
        if (!isCoachBlockedForBooking(coach, booking)) continue;
        alerts.push({
          type: 'coach_leave_conflict',
          severity: 'high',
          message: `Coach ${coach.name} is on leave but still assigned on ${normalizeDate(booking.lessonDate).toLocaleDateString('en-GB')} (${booking.guestName})`,
          coachId: coach._id,
          coachName: coach.name,
          bookingId: booking._id,
          lessonDate: booking.lessonDate,
          blockReason: block.reason,
        });
      }
    }
  }

  return alerts;
}

async function getUnassignableBookings() {
  const assignmentService = require('./assignmentService');
  const confirmed = await Booking.find({ status: 'confirmed' });
  const alerts = [];

  for (const booking of confirmed) {
    const eligible = await assignmentService.getAvailableCoachesForBooking(booking);
    if (eligible.length < booking.coachesRequired) {
      alerts.push({
        type: 'insufficient_coaches',
        severity: 'medium',
        message: `Booking ${booking.guestName} (${normalizeDate(booking.lessonDate).toLocaleDateString('en-GB')}) has insufficient eligible coaches: need ${booking.coachesRequired}, only ${eligible.length} available`,
        bookingId: booking._id,
        lessonDate: booking.lessonDate,
        coachesRequired: booking.coachesRequired,
        eligibleCount: eligible.length,
      });
    }
  }

  return alerts;
}

async function getPendingReviewCount() {
  return Booking.countDocuments({ status: 'pending' });
}

async function getAllAlerts() {
  const [leaveConflicts, insufficientCoaches, pendingCount, needsAttention] = await Promise.all([
    getCoachLeaveConflicts(),
    getUnassignableBookings(),
    getPendingReviewCount(),
    Booking.find({ status: 'needs_attention' }).sort({ lessonDate: 1 }).limit(20),
  ]);

  const attentionAlerts = needsAttention.map((b) => ({
    type: 'needs_attention',
    severity: 'high',
    message: `Booking ${b.guestName} (${normalizeDate(b.lessonDate).toLocaleDateString('en-GB')}) needs admin attention`,
    bookingId: b._id,
    lessonDate: b.lessonDate,
    adminNotes: b.adminNotes,
  }));

  const alerts = [...leaveConflicts, ...insufficientCoaches, ...attentionAlerts];

  return {
    alerts,
    summary: {
      total: alerts.length,
      high: alerts.filter((a) => a.severity === 'high').length,
      medium: alerts.filter((a) => a.severity === 'medium').length,
      pendingReview: pendingCount,
      leaveConflicts: leaveConflicts.length,
      insufficientCoaches: insufficientCoaches.length,
    },
  };
}

async function markBookingsNeedsAttentionForCoachDate(coachId, date, reason) {
  const coach = await Coach.findById(coachId);
  if (!coach) return [];

  const start = normalizeDate(date);
  const end = new Date(start.getTime() + 86400000);

  const bookings = await Booking.find({
    status: 'assigned',
    lessonDate: { $gte: start, $lt: end },
    'assignedCoaches.coach': coachId,
  });

  const affected = [];
  for (const booking of bookings) {
    if (!isCoachBlockedForBooking(coach, booking)) continue;
    booking.status = 'needs_attention';
    booking.adminNotes = `Coach on leave: ${reason || 'No reason given'}. Please reassign coaches.`;
    await booking.save();
    affected.push(booking._id);
  }

  return affected;
}

module.exports = {
  getAllAlerts,
  getCoachLeaveConflicts,
  getUnassignableBookings,
  markBookingsNeedsAttentionForCoachDate,
  isSameDay,
};
