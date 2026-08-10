const { timeToMinutes } = require('../config/gantt');

const DEFAULT_START_TIME = '09:00';
const DURATION_HOURS = [3, 4, 5, 6];

function normalizeLessonDate(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toIsoDate(dateInput) {
  const date = normalizeLessonDate(dateInput);
  if (!date) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function hasLessonSlots(booking) {
  return Array.isArray(booking?.lessonSlots) && booking.lessonSlots.length > 0;
}

function normalizeSlot(raw, fallback = {}) {
  const date = normalizeLessonDate(raw.date || raw.lessonDate);
  if (!date) return null;
  const durationHours = Number(raw.durationHours ?? fallback.durationHours);
  if (!DURATION_HOURS.includes(durationHours)) return null;
  const startTime = String(raw.startTime || fallback.startTime || DEFAULT_START_TIME).trim() || DEFAULT_START_TIME;
  return { date, startTime, durationHours };
}

function getLessonSlots(booking = {}) {
  if (hasLessonSlots(booking)) {
    return booking.lessonSlots
      .map((s) =>
        normalizeSlot(s, {
          durationHours: booking.durationHours,
          startTime: booking.lessonStartTime || DEFAULT_START_TIME,
        })
      )
      .filter(Boolean)
      .sort((a, b) => {
        const d = a.date - b.date;
        if (d !== 0) return d;
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      });
  }

  const from = booking.lessonDateFrom || booking.lessonDate;
  if (!from) return [];
  const to = booking.lessonDateTo || booking.lessonDateFrom || booking.lessonDate;
  const days = [];
  const cursor = new Date(normalizeLessonDate(from));
  const end = normalizeLessonDate(to);
  while (cursor <= end) {
    days.push({
      date: new Date(cursor),
      startTime: booking.lessonStartTime || DEFAULT_START_TIME,
      durationHours: Number(booking.durationHours) || 4,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function getSlotsOnDay(booking, day) {
  const key = toIsoDate(day);
  return getLessonSlots(booking).filter((s) => toIsoDate(s.date) === key);
}

function slotTimeRange(slot) {
  const start = timeToMinutes(slot.startTime || DEFAULT_START_TIME);
  const safeStart = start === null ? timeToMinutes(DEFAULT_START_TIME) : start;
  return { start: safeStart, end: safeStart + Number(slot.durationHours) * 60 };
}

function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function parseLessonSlots(body = {}) {
  if (Array.isArray(body.lessonSlots) && body.lessonSlots.length) {
    const slots = body.lessonSlots
      .map((s) => normalizeSlot(s))
      .filter(Boolean)
      .sort((a, b) => {
        const d = a.date - b.date;
        if (d !== 0) return d;
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      });

    if (!slots.length) {
      const error = new Error('At least one valid lesson timeslot is required');
      error.status = 400;
      throw error;
    }

    const seen = new Set();
    for (const slot of slots) {
      const key = `${toIsoDate(slot.date)}|${slot.startTime}|${slot.durationHours}`;
      if (seen.has(key)) {
        const error = new Error('Duplicate lesson timeslots are not allowed');
        error.status = 400;
        throw error;
      }
      seen.add(key);
    }

    return {
      lessonSlots: slots,
      lessonDateFrom: slots[0].date,
      lessonDateTo: slots[slots.length - 1].date,
      lessonDate: slots[0].date,
      lessonStartTime: slots[0].startTime,
      durationHours: slots[0].durationHours,
      lessonDayCount: slots.length,
    };
  }

  return null;
}

function parseLessonDateRange(body = {}) {
  const fromSlots = parseLessonSlots(body);
  if (fromSlots) return fromSlots;

  const fromInput = body.lessonDateFrom || body.lessonDate;
  const toInput = body.lessonDateTo || body.lessonDateFrom || body.lessonDate;

  if (!fromInput) {
    const error = new Error('lessonDateFrom or lessonSlots is required');
    error.status = 400;
    throw error;
  }

  const lessonDateFrom = normalizeLessonDate(fromInput);
  const lessonDateTo = normalizeLessonDate(toInput);

  if (lessonDateTo < lessonDateFrom) {
    const error = new Error('lessonDateTo must be on or after lessonDateFrom');
    error.status = 400;
    throw error;
  }

  return {
    lessonDateFrom,
    lessonDateTo,
    lessonDate: lessonDateFrom,
    lessonDayCount: getLessonDayCount({ lessonDateFrom, lessonDateTo }),
  };
}

function getBookingDateRange(booking) {
  if (hasLessonSlots(booking)) {
    const slots = getLessonSlots(booking);
    return { from: slots[0].date, to: slots[slots.length - 1].date };
  }
  const from = booking.lessonDateFrom || booking.lessonDate;
  const to = booking.lessonDateTo || booking.lessonDateFrom || booking.lessonDate;
  return {
    from: normalizeLessonDate(from),
    to: normalizeLessonDate(to),
  };
}

function getLessonDays(booking) {
  if (hasLessonSlots(booking)) {
    const seen = new Set();
    const days = [];
    for (const slot of getLessonSlots(booking)) {
      const key = toIsoDate(slot.date);
      if (seen.has(key)) continue;
      seen.add(key);
      days.push(new Date(slot.date));
    }
    return days;
  }

  const { from, to } = getBookingDateRange(booking);
  const days = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function getLessonDayCount(booking) {
  if (hasLessonSlots(booking)) return getLessonSlots(booking).length;
  return getLessonDays(booking).length;
}

function bookingOverlapsDay(booking, day) {
  if (hasLessonSlots(booking)) {
    return getSlotsOnDay(booking, day).length > 0;
  }
  const { from, to } = getBookingDateRange(booking);
  const target = normalizeLessonDate(day);
  return target >= from && target <= to;
}

function mongoOverlapsDay(day) {
  const start = normalizeLessonDate(day);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return {
    lessonDateFrom: { $lte: end },
    lessonDateTo: { $gte: start },
  };
}

function mongoOverlapsRange(queryFrom, queryTo) {
  const start = normalizeLessonDate(queryFrom);
  const end = normalizeLessonDate(queryTo);
  end.setHours(23, 59, 59, 999);
  return {
    lessonDateFrom: { $lte: end },
    lessonDateTo: { $gte: start },
  };
}

function expandBookingToDateKeys(booking, { from, to } = {}) {
  const rangeStart = from ? normalizeLessonDate(from) : null;
  const rangeEnd = to ? normalizeLessonDate(to) : null;
  if (rangeEnd) rangeEnd.setHours(23, 59, 59, 999);

  return getLessonDays(booking)
    .map((day) => toIsoDate(day))
    .filter((key) => {
      const day = normalizeLessonDate(key);
      if (rangeStart && day < rangeStart) return false;
      if (rangeEnd && day > rangeEnd) return false;
      return true;
    });
}

function formatLessonDateRange(booking, locale = 'zh-HK') {
  if (hasLessonSlots(booking)) {
    const slots = getLessonSlots(booking);
    const opts = { year: 'numeric', month: 'short', day: 'numeric' };
    if (slots.length === 1) {
      const s = slots[0];
      return `${s.date.toLocaleDateString(locale, opts)} ${s.startTime} (${s.durationHours}h)`;
    }
    const labels = slots.map(
      (s) => `${s.date.toLocaleDateString(locale, opts)} ${s.startTime}`
    );
    return `${labels.join(locale.startsWith('en') ? ', ' : '、')} (${slots.length} ${locale.startsWith('en') ? 'slots' : '堂'})`;
  }

  const { from, to } = getBookingDateRange(booking);
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  const fromStr = from.toLocaleDateString(locale, opts);
  const toStr = to.toLocaleDateString(locale, opts);
  if (fromStr === toStr) return fromStr;
  return `${fromStr} – ${toStr} (${getLessonDayCount(booking)} ${locale.startsWith('en') ? 'days' : '天'})`;
}

function syncBookingLessonDates(booking) {
  if (hasLessonSlots(booking)) {
    const slots = getLessonSlots(booking);
    if (slots.length) {
      booking.lessonSlots = slots.map((s) => ({
        date: s.date,
        startTime: s.startTime,
        durationHours: s.durationHours,
      }));
      booking.lessonDateFrom = slots[0].date;
      booking.lessonDateTo = slots[slots.length - 1].date;
      booking.lessonDate = slots[0].date;
      if (!booking.lessonStartTime) booking.lessonStartTime = slots[0].startTime;
      if (!booking.durationHours) booking.durationHours = slots[0].durationHours;
    }
    return;
  }

  if (!booking.lessonDateFrom && booking.lessonDate) {
    booking.lessonDateFrom = normalizeLessonDate(booking.lessonDate);
    booking.lessonDateTo = normalizeLessonDate(booking.lessonDate);
  }
  if (booking.lessonDateFrom && !booking.lessonDateTo) {
    booking.lessonDateTo = booking.lessonDateFrom;
  }
  if (booking.lessonDateTo && !booking.lessonDateFrom) {
    booking.lessonDateFrom = booking.lessonDateTo;
  }
  if (booking.lessonDateFrom) {
    booking.lessonDate = booking.lessonDateFrom;
  }
}

module.exports = {
  DEFAULT_START_TIME,
  normalizeLessonDate,
  toIsoDate,
  hasLessonSlots,
  getLessonSlots,
  getSlotsOnDay,
  slotTimeRange,
  rangesOverlap,
  parseLessonSlots,
  parseLessonDateRange,
  getBookingDateRange,
  getLessonDays,
  getLessonDayCount,
  bookingOverlapsDay,
  mongoOverlapsDay,
  mongoOverlapsRange,
  expandBookingToDateKeys,
  formatLessonDateRange,
  syncBookingLessonDates,
};
