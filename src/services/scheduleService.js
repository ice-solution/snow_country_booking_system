const Booking = require('../models/Booking');
const Coach = require('../models/Coach');

function normalizeDate(dateInput) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function getSchedule({ from, to, coachId }) {
  const start = from ? normalizeDate(from) : normalizeDate(new Date());
  const end = to ? normalizeDate(to) : new Date(start.getTime() + 30 * 86400000);
  end.setHours(23, 59, 59, 999);

  const bookingFilter = {
    status: { $in: ['confirmed', 'assigned', 'completed', 'needs_attention'] },
    lessonDate: { $gte: start, $lte: end },
  };

  if (coachId) {
    bookingFilter['assignedCoaches.coach'] = coachId;
  }

  const [bookings, coaches] = await Promise.all([
    Booking.find(bookingFilter)
      .populate('assignedCoaches.coach', 'name phone specialties')
      .sort({ lessonDate: 1 }),
    Coach.find(coachId ? { _id: coachId, active: true } : { active: true }).sort({ name: 1 }),
  ]);

  const byDate = {};
  for (const booking of bookings) {
    const key = normalizeDate(booking.lessonDate).toISOString().split('T')[0];
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(booking);
  }

  return {
    from: start,
    to: end,
    coaches,
    bookings,
    byDate,
    totalBookings: bookings.length,
  };
}

module.exports = { getSchedule, normalizeDate };
