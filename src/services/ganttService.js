const Booking = require('../models/Booking');
const Coach = require('../models/Coach');
const { getResort } = require('../config/resorts');
const catalogService = require('./catalogService');
const { getLeaveBlocksForCoach } = require('../utils/leavePeriods');
const {
  generateTimeSlots,
  timeToSlotIndex,
  durationToSlotSpan,
} = require('../config/gantt');
const { normalizeDate } = require('./scheduleService');

function buildLessonTag(booking) {
  const type = booking.lessonType === 'snowboard' ? 'SB' : 'SKI';
  const lang =
    booking.languagePref === 'zh' ? 'Chn' : booking.languagePref === 'en' ? 'Eng' : '';
  return `${type}${lang ? ` - ${lang}` : ''}`.trim();
}

function buildBlockLabel(booking) {
  const source = booking.source === 'klook' ? 'Klook - ' : '';
  return `${source}${booking.guestName} ${buildLessonTag(booking)}`.trim();
}

function bookingToBlock(booking, coachId, resortMap = null) {
  const resort = resortMap?.[booking.resortLocation] || getResort(booking.resortLocation);
  const location = resort || { id: 'other', name: 'TBC', nameEn: 'TBC', color: '#D1D5DB' };
  const startSlot = timeToSlotIndex(booking.lessonStartTime || '09:00');
  const spanSlots = durationToSlotSpan(booking.durationHours);

  return {
    bookingId: booking._id,
    coachId,
    guestName: booking.guestName,
    lessonType: booking.lessonType,
    source: booking.source,
    status: booking.status,
    durationHours: booking.durationHours,
    lessonStartTime: booking.lessonStartTime || '09:00',
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

async function getGantt({ date, coachId, headOnly = false }) {
  const targetDate = normalizeDate(date || new Date());
  const nextDay = new Date(targetDate.getTime() + 86400000);

  const bookingFilter = {
    status: { $in: ['confirmed', 'assigned', 'completed', 'needs_attention'] },
    lessonDate: { $gte: targetDate, $lt: nextDay },
  };

  const coachFilter = { active: true };
  if (coachId) coachFilter._id = coachId;
  if (headOnly) coachFilter.isHeadCoach = true;

  const coaches = await Coach.find(coachFilter).sort({ name: 1 });

  const bookings = await Booking.find(bookingFilter)
    .populate('assignedCoaches.coach', 'name')
    .sort({ lessonStartTime: 1 });

  const timeSlots = generateTimeSlots();
  const resortMap = await catalogService.getResortMap();
  const locations = await catalogService.getResortsConfig();
  const rows = [];

  for (const coach of coaches) {
    const coachBookings = bookings.filter((b) =>
      b.assignedCoaches.some((a) => a.coach?._id?.toString() === coach._id.toString())
    );

    rows.push({
      coachId: coach._id,
      coachName: coach.name,
      specialties: coach.specialties,
      leaveBlocks: getLeaveBlocksForCoach(coach, targetDate, timeSlots.length),
      blocks: coachBookings.map((b) => bookingToBlock(b, coach._id, resortMap)),
    });
  }

  const unassigned = bookings
    .filter((b) => !b.assignedCoaches?.length)
    .map((b) => bookingToBlock(b, null, resortMap));

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
    totalCoaches: coaches.length,
    totalBookings: bookings.length,
    capacity,
    headOnly: Boolean(headOnly),
  };
}

async function getCoachSchedule(coachId, { from, to } = {}) {
  const start = from ? normalizeDate(from) : normalizeDate(new Date());
  const end = to ? normalizeDate(to) : new Date(start.getTime() + 14 * 86400000);
  end.setHours(23, 59, 59, 999);

  const coach = await Coach.findById(coachId);
  if (!coach) {
    const error = new Error('Coach not found');
    error.status = 404;
    throw error;
  }

  const resortMap = await catalogService.getResortMap();

  const bookings = await Booking.find({
    status: { $in: ['confirmed', 'assigned', 'completed', 'needs_attention'] },
    lessonDate: { $gte: start, $lte: end },
    'assignedCoaches.coach': coachId,
  }).sort({ lessonDate: 1, lessonStartTime: 1 });

  const byDate = {};
  for (const booking of bookings) {
    const key = normalizeDate(booking.lessonDate).toISOString().split('T')[0];
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(bookingToBlock(booking, coachId, resortMap));
  }

  return {
    coach: { id: coach._id, name: coach.name, specialties: coach.specialties },
    from: start,
    to: end,
    byDate,
    bookings: bookings.map((b) => bookingToBlock(b, coachId, resortMap)),
    locations: await catalogService.getResortsConfig(),
  };
}

module.exports = { getGantt, getCoachSchedule, bookingToBlock };
