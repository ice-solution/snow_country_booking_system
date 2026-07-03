const { timeToMinutes } = require('../config/gantt');

const DEFAULT_START_TIME = '09:00';

function getBookingTimeRange(booking) {
  const start = timeToMinutes(booking.lessonStartTime || DEFAULT_START_TIME);
  if (start === null) {
    return { start: timeToMinutes(DEFAULT_START_TIME), end: timeToMinutes(DEFAULT_START_TIME) + booking.durationHours * 60 };
  }
  return { start, end: start + Number(booking.durationHours) * 60 };
}

function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function bookingsOverlap(bookingA, bookingB) {
  return rangesOverlap(getBookingTimeRange(bookingA), getBookingTimeRange(bookingB));
}

function formatTimeRange(booking) {
  const { start, end } = getBookingTimeRange(booking);
  const fmt = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  return `${fmt(start)}–${fmt(end)}`;
}

module.exports = {
  DEFAULT_START_TIME,
  getBookingTimeRange,
  rangesOverlap,
  bookingsOverlap,
  formatTimeRange,
};
