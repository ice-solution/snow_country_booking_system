const Booking = require('../models/Booking');
const Instructor = require('../models/Instructor');
const { isCoachBlockedForBookingOnDate } = require('../utils/leavePeriods');
const { mongoOverlapsDay, formatLessonDateRange } = require('../utils/lessonDateRange');

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
  const coaches = await Instructor.find({ active: true, 'blockedDates.0': { $exists: true } });
  const alerts = [];

  for (const coach of coaches) {
    for (const block of coach.blockedDates) {
      const bookings = await Booking.find({
        status: { $in: ['assigned', 'confirmed'] },
        ...mongoOverlapsDay(block.date),
        'assignedCoaches.coach': coach._id,
      }).select('guestName lessonDateFrom lessonDateTo lessonDate durationHours status phone');

      for (const booking of bookings) {
        if (!isCoachBlockedForBookingOnDate(coach, booking, block.date)) continue;
        alerts.push({
          type: 'coach_leave_conflict',
          severity: 'high',
          message: `Instructor ${coach.name} is on leave but still assigned on ${formatLessonDateRange(booking, 'en-GB')} (${booking.guestName})`,
          coachId: coach._id,
          coachName: coach.name,
          bookingId: booking._id,
          lessonDate: booking.lessonDateFrom || booking.lessonDate,
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
        message: `Booking ${booking.guestName} (${formatLessonDateRange(booking, 'en-GB')}) has insufficient eligible instructors: need ${booking.coachesRequired}, only ${eligible.length} available`,
        bookingId: booking._id,
        lessonDate: booking.lessonDateFrom || booking.lessonDate,
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
    Booking.find({ status: 'needs_attention' }).sort({ lessonDateFrom: 1 }).limit(20),
  ]);

  const attentionAlerts = needsAttention.map((b) => ({
    type: 'needs_attention',
    severity: 'high',
    message: `Booking ${b.guestName} (${formatLessonDateRange(b, 'en-GB')}) needs admin attention`,
    bookingId: b._id,
    lessonDate: b.lessonDateFrom || b.lessonDate,
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

async function markBookingsNeedsAttentionForInstructorDate(instructorId, date, reason) {
  const instructor = await Instructor.findById(instructorId);
  if (!instructor) return [];

  const { mongoOverlapsDay } = require('../utils/lessonDateRange');
  const { isCoachBlockedForBookingOnDate } = require('../utils/leavePeriods');
  const target = normalizeDate(date);

  const bookings = await Booking.find({
    status: 'assigned',
    ...mongoOverlapsDay(target),
    'assignedCoaches.coach': instructorId,
  });

  const affected = [];
  for (const booking of bookings) {
    if (!isCoachBlockedForBookingOnDate(instructor, booking, target)) continue;
    booking.status = 'needs_attention';
    booking.adminNotes = `Instructor on leave: ${reason || 'No reason given'}. Please reassign instructors.`;
    await booking.save();
    affected.push(booking._id);
  }

  return affected;
}

module.exports = {
  getAllAlerts,
  getCoachLeaveConflicts,
  getUnassignableBookings,
  markBookingsNeedsAttentionForInstructorDate,
  markBookingsNeedsAttentionForCoachDate: markBookingsNeedsAttentionForInstructorDate,
  isSameDay,
};
