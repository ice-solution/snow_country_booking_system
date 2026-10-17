const Booking = require('../models/Booking');
const Instructor = require('../models/Instructor');
const catalogService = require('./catalogService');
const { getLeaveBlocksForInstructor } = require('../utils/leavePeriods');
const {
  generateTimeSlots,
  timeToSlotIndex,
  durationToSlotSpan,
} = require('../config/gantt');
const { normalizeDate } = require('./scheduleService');
const {
  mongoOverlapsDay,
  mongoOverlapsRange,
  expandBookingToDateKeys,
  getLessonDayCount,
  bookingOverlapsDay,
  getSlotsOnDay,
} = require('../utils/lessonDateRange');

function buildLessonTag(booking) {
  const type = booking.lessonType === 'snowboard' ? 'SB' : 'SKI';
  const lang =
    booking.languagePref === 'zh' ? 'Chn' : booking.languagePref === 'en' ? 'Eng' : '';
  const dayCount = getLessonDayCount(booking);
  const daySuffix = dayCount > 1 ? ` · ${dayCount}d` : '';
  return `${type}${lang ? ` - ${lang}` : ''}${daySuffix}`.trim();
}

function buildBlockLabel(booking) {
  const source = booking.source === 'klook' ? 'Klook - ' : '';
  return `${source}${booking.guestName} ${buildLessonTag(booking)}`.trim();
}

function bookingToBlock(booking, instructorId, resortMap = null, date = null) {
  const resort = resortMap?.[booking.resortLocation];
  const location = resort || { id: 'other', name: 'TBC', nameEn: 'TBC', color: '#D1D5DB' };
  const slot = date ? getSlotsOnDay(booking, date)[0] : null;
  const startTime = slot?.startTime || booking.lessonStartTime || '09:00';
  const durationHours = slot?.durationHours || booking.durationHours;
  const startSlot = timeToSlotIndex(startTime);
  const spanSlots = durationToSlotSpan(durationHours);

  return {
    bookingId: booking._id,
    instructorId,
    guestName: booking.guestName,
    lessonType: booking.lessonType,
    source: booking.source,
    status: booking.status,
    durationHours,
    lessonStartTime: startTime,
    lessonDayCount: getLessonDayCount(booking),
    location: location.id,
    locationName: location.name,
    color: location.color,
    startSlot,
    spanSlots,
    label: buildBlockLabel(booking),
    lessonTag: buildLessonTag(booking),
    sourcePrefix: booking.source === 'klook' ? 'Klook · ' : '',
    region: booking.region,
    totalGuests: booking.totalGuests,
    phone: booking.phone,
  };
}

async function getGantt({ date, instructorId, headOnly = false }) {
  const targetDate = normalizeDate(date || new Date());

  const bookingFilter = {
    status: { $in: ['confirmed', 'assigned', 'completed', 'needs_attention'] },
    ...mongoOverlapsDay(targetDate),
  };

  const instructorFilter = { active: true };
  if (instructorId) instructorFilter._id = instructorId;
  if (headOnly) instructorFilter.isHeadInstructor = true;

  const instructors = await Instructor.find(instructorFilter).sort({ name: 1 });

  const bookings = (await Booking.find(bookingFilter)
    .populate('assignedInstructors.instructor', 'name')
    .sort({ lessonStartTime: 1 })).filter((b) => bookingOverlapsDay(b, targetDate));

  const timeSlots = generateTimeSlots();
  const resortMap = await catalogService.getResortMap();
  const locations = await catalogService.getResortsConfig();
  const rows = [];

  for (const instructor of instructors) {
    const instructorBookings = bookings.filter((b) =>
      b.assignedInstructors.some(
        (a) => a.instructor?._id?.toString() === instructor._id.toString()
      )
    );

    rows.push({
      instructorId: instructor._id,
      instructorName: instructor.name,
      specialties: instructor.specialties,
      leaveBlocks: getLeaveBlocksForInstructor(instructor, targetDate, timeSlots.length),
      blocks: instructorBookings.map((b) => bookingToBlock(b, instructor._id, resortMap, targetDate)),
    });
  }

  const unassigned = bookings
    .filter((b) => !b.assignedInstructors?.length)
    .map((b) => bookingToBlock(b, null, resortMap, targetDate));

  const { getDailyCapacity } = require('./capacityService');
  const capacity = await getDailyCapacity(targetDate, { headOnly });

  return {
    date: targetDate.toISOString().split('T')[0],
    timeSlots,
    slotMinutes: 30,
    hoursPerSlot: 0.5,
    locations,
    rows,
    unassigned,
    totalInstructors: instructors.length,
    totalBookings: bookings.length,
    capacity,
    headOnly: Boolean(headOnly),
  };
}

async function getInstructorSchedule(instructorId, { from, to } = {}) {
  const start = from ? normalizeDate(from) : normalizeDate(new Date());
  const end = to ? normalizeDate(to) : new Date(start.getTime() + 14 * 86400000);
  end.setHours(23, 59, 59, 999);

  const instructor = await Instructor.findById(instructorId);
  if (!instructor) {
    const error = new Error('Instructor not found');
    error.status = 404;
    throw error;
  }

  const resortMap = await catalogService.getResortMap();

  const bookings = await Booking.find({
    status: { $in: ['confirmed', 'assigned', 'completed', 'needs_attention'] },
    ...mongoOverlapsRange(start, end),
    'assignedInstructors.instructor': instructorId,
  }).sort({ lessonDateFrom: 1, lessonStartTime: 1 });

  const byDate = {};
  for (const booking of bookings) {
    for (const key of expandBookingToDateKeys(booking, { from: start, to: end })) {
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(bookingToBlock(booking, instructorId, resortMap, key));
    }
  }

  return {
    instructor: { id: instructor._id, name: instructor.name, specialties: instructor.specialties },
    from: start,
    to: end,
    byDate,
    bookings: bookings.map((b) => bookingToBlock(b, instructorId, resortMap)),
    locations: await catalogService.getResortsConfig(),
  };
}

module.exports = { getGantt, getInstructorSchedule, bookingToBlock };
