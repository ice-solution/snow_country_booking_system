const Booking = require('../models/Booking');
const Coach = require('../models/Coach');
const { normalizeDate } = require('./scheduleService');
const { isCoachOnFullDayLeave } = require('../utils/leavePeriods');

const ACTIVE_STATUSES = ['pending', 'confirmed', 'assigned', 'needs_attention'];

function isSameDay(a, b) {
  const d1 = normalizeDate(a);
  const d2 = normalizeDate(b);
  return d1.getTime() === d2.getTime();
}

function coachAvailableOnDate(coach, date) {
  return !isCoachOnFullDayLeave(coach, date);
}

async function getDailyCapacity(date, { headOnly = false } = {}) {
  const targetDate = normalizeDate(date);
  const nextDay = new Date(targetDate.getTime() + 86400000);

  const coachFilter = { active: true };
  if (headOnly) coachFilter.isHeadCoach = true;

  const coaches = await Coach.find(coachFilter);
  const availableCoaches = coaches.filter((c) => coachAvailableOnDate(c, targetDate));

  const supply = availableCoaches.reduce((sum, c) => sum + (c.maxDailyLessons || 2), 0);

  const bookings = await Booking.find({
    status: { $in: ACTIVE_STATUSES },
    lessonDate: { $gte: targetDate, $lt: nextDay },
  });

  const demand = bookings.reduce((sum, b) => sum + (b.coachesRequired || 1), 0);
  const unassigned = bookings.filter((b) => !b.assignedCoaches?.length).length;
  const remaining = supply - demand;

  let status = 'ok';
  if (demand > supply) status = 'overbooked';
  else if (supply > 0 && demand >= supply * 0.85) status = 'tight';

  return {
    date: targetDate.toISOString().split('T')[0],
    supply,
    demand,
    remaining,
    unassigned,
    coachCount: availableCoaches.length,
    status,
    overbooked: demand > supply,
  };
}

async function getCapacityRange(from, to, options = {}) {
  const start = normalizeDate(from);
  const end = normalizeDate(to);
  const days = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(await getDailyCapacity(cursor, options));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

module.exports = { getDailyCapacity, getCapacityRange, ACTIVE_STATUSES };
