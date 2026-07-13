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
  return date.toISOString().split('T')[0];
}

function parseLessonDateRange(body = {}) {
  const fromInput = body.lessonDateFrom || body.lessonDate;
  const toInput = body.lessonDateTo || body.lessonDateFrom || body.lessonDate;

  if (!fromInput) {
    const error = new Error('lessonDateFrom is required');
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
  const from = booking.lessonDateFrom || booking.lessonDate;
  const to = booking.lessonDateTo || booking.lessonDateFrom || booking.lessonDate;
  return {
    from: normalizeLessonDate(from),
    to: normalizeLessonDate(to),
  };
}

function getLessonDays(booking) {
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
  return getLessonDays(booking).length;
}

function bookingOverlapsDay(booking, day) {
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
  const { from, to } = getBookingDateRange(booking);
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  const fromStr = from.toLocaleDateString(locale, opts);
  const toStr = to.toLocaleDateString(locale, opts);
  if (fromStr === toStr) return fromStr;
  return `${fromStr} – ${toStr} (${getLessonDayCount(booking)} ${locale.startsWith('en') ? 'days' : '天'})`;
}

function syncBookingLessonDates(booking) {
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
  normalizeLessonDate,
  toIsoDate,
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
