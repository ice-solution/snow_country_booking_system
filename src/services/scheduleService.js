const Booking = require('../models/Booking');
const Instructor = require('../models/Instructor');
const { mongoOverlapsRange, expandBookingToDateKeys } = require('../utils/lessonDateRange');

function normalizeDate(dateInput) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function getSchedule({ from, to, instructorId }) {
  const start = from ? normalizeDate(from) : normalizeDate(new Date());
  const end = to ? normalizeDate(to) : new Date(start.getTime() + 30 * 86400000);
  end.setHours(23, 59, 59, 999);

  const bookingFilter = {
    status: { $in: ['confirmed', 'assigned', 'completed', 'needs_attention'] },
    ...mongoOverlapsRange(start, end),
  };

  if (instructorId) {
    bookingFilter['assignedInstructors.instructor'] = instructorId;
  }

  const [bookings, instructors] = await Promise.all([
    Booking.find(bookingFilter)
      .populate('assignedInstructors.instructor', 'name phone specialties')
      .sort({ lessonDateFrom: 1 }),
    Instructor.find(instructorId ? { _id: instructorId, active: true } : { active: true }).sort({
      name: 1,
    }),
  ]);

  const byDate = {};
  for (const booking of bookings) {
    for (const key of expandBookingToDateKeys(booking, { from: start, to: end })) {
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(booking);
    }
  }

  return {
    from: start,
    to: end,
    instructors,
    bookings,
    byDate,
    totalBookings: bookings.length,
  };
}

module.exports = { getSchedule, normalizeDate };
