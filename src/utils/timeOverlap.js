const { timeToMinutes } = require('../config/gantt');
const {
  DEFAULT_START_TIME,
  getSlotsOnDay,
  getLessonSlots,
  slotTimeRange,
  rangesOverlap,
} = require('./lessonDateRange');

function getBookingTimeRange(booking) {
  const slots = getLessonSlots(booking);
  if (slots.length) return slotTimeRange(slots[0]);
  const start = timeToMinutes(booking.lessonStartTime || DEFAULT_START_TIME);
  if (start === null) {
    return {
      start: timeToMinutes(DEFAULT_START_TIME),
      end: timeToMinutes(DEFAULT_START_TIME) + booking.durationHours * 60,
    };
  }
  return { start, end: start + Number(booking.durationHours) * 60 };
}

function bookingsOverlapOnDay(bookingA, bookingB, day) {
  const rangesA = getSlotsOnDay(bookingA, day).map(slotTimeRange);
  const rangesB = getSlotsOnDay(bookingB, day).map(slotTimeRange);
  if (!rangesA.length || !rangesB.length) return false;
  return rangesA.some((a) => rangesB.some((b) => rangesOverlap(a, b)));
}

function bookingsOverlap(bookingA, bookingB) {
  const daysA = new Set(
    getLessonSlots(bookingA).map((s) =>
      [
        s.date.getFullYear(),
        String(s.date.getMonth() + 1).padStart(2, '0'),
        String(s.date.getDate()).padStart(2, '0'),
      ].join('-')
    )
  );
  for (const slot of getLessonSlots(bookingB)) {
    const key = [
      slot.date.getFullYear(),
      String(slot.date.getMonth() + 1).padStart(2, '0'),
      String(slot.date.getDate()).padStart(2, '0'),
    ].join('-');
    if (daysA.has(key) && bookingsOverlapOnDay(bookingA, bookingB, slot.date)) {
      return true;
    }
  }
  return false;
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
  bookingsOverlapOnDay,
  formatTimeRange,
};
