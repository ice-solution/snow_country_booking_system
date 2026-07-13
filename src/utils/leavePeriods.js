const { timeToSlotIndex, timeToMinutes } = require('../config/gantt');

const LEAVE_PERIODS = ['full', 'half_am', 'half_pm'];

const HALF_SLOTS = {
  half_am: { start: '09:00', end: '12:00' },
  half_pm: { start: '13:00', end: '16:00' },
};

function normalizePeriod(period) {
  if (period === 'half_am' || period === 'half_pm') return period;
  return 'full';
}

function getLessonMinutes(booking) {
  const start = timeToMinutes(booking.lessonStartTime || '09:00');
  if (start === null) return null;
  const end = start + Number(booking.durationHours || 0) * 60;
  return { start, end };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function lessonOverlapsWindow(booking, windowStart, windowEnd) {
  const lesson = getLessonMinutes(booking);
  if (!lesson) return true;
  const start = timeToMinutes(windowStart);
  const end = timeToMinutes(windowEnd);
  if (start === null || end === null) return true;
  return rangesOverlap(lesson.start, lesson.end, start, end);
}

function isSameDay(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return d1.getTime() === d2.getTime();
}

function getBlocksForDate(coach, date) {
  return (coach.blockedDates || []).filter((block) => isSameDay(block.date, date));
}

function isCoachOnFullDayLeave(coach, date) {
  return getBlocksForDate(coach, date).some((block) => normalizePeriod(block.period) === 'full');
}

function isCoachBlockedForBookingOnDate(coach, booking, date) {
  const blocks = getBlocksForDate(coach, date);
  if (!blocks.length) return false;

  for (const block of blocks) {
    const period = normalizePeriod(block.period);
    if (period === 'full') return true;
    const slot = HALF_SLOTS[period];
    if (slot && lessonOverlapsWindow(booking, slot.start, slot.end)) return true;
  }
  return false;
}

function isCoachBlockedForBooking(coach, booking) {
  const { getLessonDays } = require('./lessonDateRange');
  return getLessonDays(booking).some((day) => isCoachBlockedForBookingOnDate(coach, booking, day));
}

function leavePeriodToGanttBlock(period, totalSlots) {
  const normalized = normalizePeriod(period);
  if (normalized === 'full') {
    return { startSlot: 0, spanSlots: totalSlots, period: 'full' };
  }

  const slot = HALF_SLOTS[normalized];
  const startSlot = timeToSlotIndex(slot.start);
  const endSlot = timeToSlotIndex(slot.end);
  return {
    startSlot,
    spanSlots: Math.max(1, endSlot - startSlot),
    period: normalized,
    label: `${slot.start}–${slot.end}`,
  };
}

function getLeaveBlocksForCoach(coach, date, totalSlots) {
  return getBlocksForDate(coach, date).map((block) => ({
    ...leavePeriodToGanttBlock(block.period, totalSlots),
    reason: block.reason || '',
  }));
}

function leavePeriodLabel(period) {
  const normalized = normalizePeriod(period);
  if (normalized === 'half_am') return 'Half day AM (09:00–12:00)';
  if (normalized === 'half_pm') return 'Half day PM (13:00–16:00)';
  return 'Full day';
}

module.exports = {
  LEAVE_PERIODS,
  HALF_SLOTS,
  normalizePeriod,
  lessonOverlapsWindow,
  isCoachOnFullDayLeave,
  isCoachBlockedForBooking,
  isCoachBlockedForBookingOnDate,
  getBlocksForDate,
  getLeaveBlocksForCoach,
  leavePeriodLabel,
  leavePeriodToGanttBlock,
};
