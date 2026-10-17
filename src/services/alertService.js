const Booking = require('../models/Booking');
const Instructor = require('../models/Instructor');
const { isInstructorBlockedForBookingOnDate } = require('../utils/leavePeriods');
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

async function getInstructorLeaveConflicts() {
  const instructors = await Instructor.find({ active: true, 'blockedDates.0': { $exists: true } });
  const alerts = [];

  for (const instructor of instructors) {
    for (const block of instructor.blockedDates) {
      const bookings = await Booking.find({
        status: { $in: ['assigned', 'confirmed'] },
        ...mongoOverlapsDay(block.date),
        'assignedInstructors.instructor': instructor._id,
      }).select('guestName lessonDateFrom lessonDateTo lessonDate durationHours status phone');

      for (const booking of bookings) {
        if (!isInstructorBlockedForBookingOnDate(instructor, booking, block.date)) continue;
        alerts.push({
          type: 'instructor_leave_conflict',
          severity: 'high',
          message: `Instructor ${instructor.name} is on leave but still assigned on ${formatLessonDateRange(booking, 'en-GB')} (${booking.guestName})`,
          instructorId: instructor._id,
          instructorName: instructor.name,
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
    const eligible = await assignmentService.getAvailableInstructorsForBooking(booking);
    if (eligible.length < booking.instructorsRequired) {
      alerts.push({
        type: 'insufficient_instructors',
        severity: 'medium',
        message: `Booking ${booking.guestName} (${formatLessonDateRange(booking, 'en-GB')}) has insufficient eligible instructors: need ${booking.instructorsRequired}, only ${eligible.length} available`,
        bookingId: booking._id,
        lessonDate: booking.lessonDateFrom || booking.lessonDate,
        instructorsRequired: booking.instructorsRequired,
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
  const [leaveConflicts, insufficientInstructors, pendingCount, needsAttention] = await Promise.all([
    getInstructorLeaveConflicts(),
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

  const alerts = [...leaveConflicts, ...insufficientInstructors, ...attentionAlerts];

  return {
    alerts,
    summary: {
      total: alerts.length,
      high: alerts.filter((a) => a.severity === 'high').length,
      medium: alerts.filter((a) => a.severity === 'medium').length,
      pendingReview: pendingCount,
      leaveConflicts: leaveConflicts.length,
      insufficientInstructors: insufficientInstructors.length,
    },
  };
}

async function markBookingsNeedsAttentionForInstructorDate(instructorId, date, reason) {
  const instructor = await Instructor.findById(instructorId);
  if (!instructor) return [];

  const { mongoOverlapsDay } = require('../utils/lessonDateRange');
  const target = normalizeDate(date);

  const bookings = await Booking.find({
    status: 'assigned',
    ...mongoOverlapsDay(target),
    'assignedInstructors.instructor': instructorId,
  });

  const affected = [];
  for (const booking of bookings) {
    if (!isInstructorBlockedForBookingOnDate(instructor, booking, target)) continue;
    booking.status = 'needs_attention';
    booking.adminNotes = `Instructor on leave: ${reason || 'No reason given'}. Please reassign instructors.`;
    await booking.save();
    affected.push(booking._id);
  }

  return affected;
}

module.exports = {
  getAllAlerts,
  getInstructorLeaveConflicts,
  getUnassignableBookings,
  markBookingsNeedsAttentionForInstructorDate,
  isSameDay,
};
