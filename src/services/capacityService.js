const Booking = require('../models/Booking');
const Instructor = require('../models/Instructor');
const { normalizeDate } = require('./scheduleService');
const { isInstructorOnFullDayLeave } = require('../utils/leavePeriods');
const { mongoOverlapsDay, bookingOverlapsDay } = require('../utils/lessonDateRange');

const ACTIVE_STATUSES = ['pending', 'confirmed', 'assigned', 'needs_attention'];

function instructorAvailableOnDate(instructor, date) {
  return !isInstructorOnFullDayLeave(instructor, date);
}

async function getDailyCapacity(date, { headOnly = false } = {}) {
  const targetDate = normalizeDate(date);

  const instructorFilter = { active: true };
  if (headOnly) instructorFilter.isHeadInstructor = true;

  const instructors = await Instructor.find(instructorFilter);
  const availableInstructors = instructors.filter((i) => instructorAvailableOnDate(i, targetDate));

  const supply = availableInstructors.reduce((sum, i) => sum + (i.maxDailyLessons || 2), 0);

  const bookings = (await Booking.find({
    status: { $in: ACTIVE_STATUSES },
    ...mongoOverlapsDay(targetDate),
  })).filter((b) => bookingOverlapsDay(b, targetDate));

  const demand = bookings.reduce((sum, b) => sum + (b.instructorsRequired || 1), 0);
  const unassigned = bookings.filter((b) => !b.assignedInstructors?.length).length;
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
    instructorCount: availableInstructors.length,
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
