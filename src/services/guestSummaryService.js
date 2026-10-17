const Booking = require('../models/Booking');
const { getLessonDayCount } = require('../utils/lessonDateRange');

function toGuestSummary(booking) {
  return {
    id: booking._id,
    guestName: booking.guestName,
    phone: booking.phone,
    email: booking.email || '',
    instagram: booking.instagram || '',
    facebook: booking.facebook || '',
    whatsapp: booking.whatsapp || '',
    line: booking.line || '',
    wechat: booking.wechat || '',
    languagePref: booking.languagePref,
    specialRequests: booking.specialRequests || '',
    lessonDateFrom: booking.lessonDateFrom || booking.lessonDate,
    lessonDateTo: booking.lessonDateTo || booking.lessonDateFrom || booking.lessonDate,
    lessonDate: booking.lessonDateFrom || booking.lessonDate,
    lessonSlots: Array.isArray(booking.lessonSlots)
      ? booking.lessonSlots.map((s) => ({
          date: s.date,
          startTime: s.startTime || booking.lessonStartTime || '09:00',
          durationHours: s.durationHours || booking.durationHours,
        }))
      : undefined,
    lessonDayCount: getLessonDayCount(booking),
    lessonStartTime: booking.lessonStartTime || '09:00',
    durationHours: booking.durationHours,
    resortLocation: booking.resortLocation,
    region: booking.region,
    lessonType: booking.lessonType,
    totalGuests: booking.totalGuests,
    childrenUnder6: booking.childrenUnder6,
    instructorsRequired: booking.instructorsRequired,
    source: booking.source,
    status: booking.status,
    assignedInstructors: (booking.assignedInstructors || [])
      .map((a) => a.instructor?.name)
      .filter(Boolean),
  };
}

async function getGuestSummaryById(bookingId) {
  const booking = await Booking.findById(bookingId).populate(
    'assignedInstructors.instructor',
    'name'
  );
  if (!booking) {
    const error = new Error('Booking not found');
    error.status = 404;
    throw error;
  }
  return toGuestSummary(booking);
}

async function getGuestSummaryForInstructor(bookingId, instructorId) {
  if (!instructorId) {
    const error = new Error('instructorId is required');
    error.status = 400;
    throw error;
  }

  const booking = await Booking.findById(bookingId).populate(
    'assignedInstructors.instructor',
    'name'
  );
  if (!booking) {
    const error = new Error('Booking not found');
    error.status = 404;
    throw error;
  }

  const isAssigned = (booking.assignedInstructors || []).some((a) => {
    const id = a.instructor?._id?.toString() || a.instructor?.toString();
    return id === instructorId;
  });

  if (!isAssigned) {
    const error = new Error('This lesson is not assigned to the selected instructor');
    error.status = 403;
    throw error;
  }

  return toGuestSummary(booking);
}

module.exports = {
  toGuestSummary,
  getGuestSummaryById,
  getGuestSummaryForInstructor,
};
