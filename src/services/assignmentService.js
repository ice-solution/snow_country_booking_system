const Booking = require('../models/Booking');
const Instructor = require('../models/Instructor');
const { calculateCoachesRequired } = require('../utils/coachRequirement');
const { bookingsOverlapOnDay, formatTimeRange } = require('../utils/timeOverlap');
const {
  isCoachBlockedForBookingOnDate,
} = require('../utils/leavePeriods');
const {
  getLessonDays,
  getLessonDayCount,
  mongoOverlapsDay,
  bookingOverlapsDay,
  toIsoDate,
} = require('../utils/lessonDateRange');

const HEAT_SCORE = { high: 10, medium: 5, low: 2 };

function scoreCoachWithBreakdown(coach, booking) {
  const breakdown = [];
  let score = 0;

  if (coach.specialties.includes(booking.lessonType)) {
    score += 30;
    breakdown.push({ factor: 'Specialty match', points: 30 });
  } else {
    breakdown.push({ factor: 'Specialty mismatch', points: 0 });
  }

  if (booking.languagePref === 'any' || coach.languages.includes(booking.languagePref)) {
    score += 25;
    breakdown.push({ factor: 'Language match', points: 25 });
  } else {
    breakdown.push({ factor: 'Language mismatch', points: 0 });
  }

  if (booking.specialRequests) {
    const requests = booking.specialRequests.toLowerCase();
    if (requests.includes('內地') || requests.includes('mainland')) {
      if (coach.isMainland) {
        score += 20;
        breakdown.push({ factor: 'Mainland instructor requested', points: 20 });
      } else {
        score -= 10;
        breakdown.push({ factor: 'Not a mainland instructor', points: -10 });
      }
    }
  }

  const skillPts = coach.skillLevel * 3;
  score += skillPts;
  breakdown.push({ factor: `Skill level (${coach.skillLevel}/5)`, points: skillPts });

  const heatPts = HEAT_SCORE[coach.heatLevel] || 0;
  score += heatPts;
  breakdown.push({ factor: `Teaching heat (${coach.heatLevel})`, points: heatPts });

  const dayCount = getLessonDayCount(booking);
  if (dayCount > 1) {
    breakdown.push({ factor: `${dayCount}-slot booking`, points: 0 });
  }

  return { score, breakdown };
}

function scoreCoach(coach, booking) {
  return scoreCoachWithBreakdown(coach, booking).score;
}

async function getCoachBookingsOnDate(coachId, lessonDate, excludeBookingId = null) {
  const filter = {
    status: { $in: ['confirmed', 'assigned', 'completed', 'needs_attention'] },
    ...mongoOverlapsDay(lessonDate),
    'assignedCoaches.coach': coachId,
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };

  const bookings = await Booking.find(filter);
  return bookings.filter((b) => bookingOverlapsDay(b, lessonDate));
}

async function findTimeConflict(coachId, booking, day, excludeBookingId = null) {
  const existing = await getCoachBookingsOnDate(coachId, day, excludeBookingId);
  return existing.find((b) => bookingsOverlapOnDay(booking, b, day)) || null;
}

async function getDailyLessonCount(coachId, lessonDate, excludeBookingId = null) {
  const bookings = await getCoachBookingsOnDate(coachId, lessonDate, excludeBookingId);
  return bookings.length;
}

function isCoachAvailableOnDay(coach, lessonDate) {
  const dayOfWeek = new Date(lessonDate).getDay();
  const entry = coach.weeklyAvailability.find((a) => a.dayOfWeek === dayOfWeek);
  if (entry) return entry.available;
  return true;
}

async function coachPassesAllLessonDays(coach, booking, { forReassign = false } = {}) {
  const days = getLessonDays(booking);
  let maxDailyCount = 0;

  for (const day of days) {
    if (isCoachBlockedForBookingOnDate(coach, booking, day)) {
      return { ok: false, reason: `${coach.name} is on leave on ${toIsoDate(day)}` };
    }
    if (!isCoachAvailableOnDay(coach, day)) {
      return { ok: false, reason: `${coach.name} is not available on ${toIsoDate(day)}` };
    }

    const dailyCount = await getDailyLessonCount(coach._id, day, booking._id);
    maxDailyCount = Math.max(maxDailyCount, dailyCount);
    if (dailyCount >= coach.maxDailyLessons) {
      return {
        ok: false,
        reason: `${coach.name} already has ${dailyCount} lesson(s) on ${toIsoDate(day)} (max ${coach.maxDailyLessons})`,
      };
    }

    const conflict = await findTimeConflict(coach._id, booking, day, booking._id);
    if (conflict) {
      return {
        ok: false,
        reason: `${coach.name} has a schedule conflict on ${toIsoDate(day)} with ${conflict.guestName}`,
      };
    }
  }

  const alreadyAssigned = booking.assignedCoaches?.some(
    (a) => a.coach.toString() === coach._id.toString()
  );
  if (!forReassign && alreadyAssigned) {
    return { ok: false, reason: `${coach.name} is already assigned` };
  }

  return { ok: true, maxDailyCount };
}

async function getAvailableCoachesForBooking(booking, { excludeCoachIds = [], forReassign = false } = {}) {
  const coaches = await Instructor.find({ active: true });
  const eligible = [];
  const excluded = new Set(excludeCoachIds.map(String));

  for (const coach of coaches) {
    if (excluded.has(coach._id.toString())) continue;
    if (!coach.specialties.includes(booking.lessonType)) continue;

    const dayCheck = await coachPassesAllLessonDays(coach, booking, { forReassign });
    if (!dayCheck.ok) continue;

    const { score, breakdown } = scoreCoachWithBreakdown(coach, booking);
    const workloadPenalty = (dayCheck.maxDailyCount || 0) * 5;
    const finalScore = score - workloadPenalty;

    eligible.push({
      coach,
      score: finalScore,
      baseScore: score,
      breakdown: [
        ...breakdown,
        ...(dayCheck.maxDailyCount > 0
          ? [{ factor: `Up to ${dayCheck.maxDailyCount} lesson(s)/day in range`, points: -workloadPenalty }]
          : []),
      ],
      dailyLessonCount: dayCheck.maxDailyCount,
    });
  }

  eligible.sort((a, b) => b.score - a.score);
  return eligible;
}

function mapInstructorSuggestion(item) {
  return {
    instructorId: item.coach._id,
    name: item.coach.name,
    score: item.score,
    breakdown: item.breakdown,
    specialties: item.coach.specialties,
    languages: item.coach.languages,
    isMainland: item.coach.isMainland,
    heatLevel: item.coach.heatLevel,
    skillLevel: item.coach.skillLevel,
    dailyLessonCount: item.dailyLessonCount,
  };
}

async function suggestCoachesForBooking(bookingId, { forReassign = false } = {}) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.status = 404;
    throw error;
  }

  const eligible = await getAvailableCoachesForBooking(booking, { forReassign });
  const suggestions = [];
  const required = booking.coachesRequired;

  if (required === 2 && eligible.length >= 2) {
    const first = eligible[0];
    suggestions.push(mapInstructorSuggestion(first));
    const secondPool = await getAvailableCoachesForBooking(booking, {
      excludeCoachIds: [first.coach._id],
    });
    if (secondPool.length) suggestions.push(mapInstructorSuggestion(secondPool[0]));
  } else {
    eligible.slice(0, required).forEach((item) => {
      suggestions.push(mapInstructorSuggestion(item));
    });
  }

  return {
    bookingId: booking._id,
    instructorsRequired: required,
    lessonDayCount: getLessonDayCount(booking),
    canAutoAssign: suggestions.length >= required,
    suggestions,
    allEligible: eligible.map((item) => ({
      instructorId: item.coach._id,
      name: item.coach.name,
      score: item.score,
    })),
  };
}

async function applyCoachAssignment(booking, coachIds, assignedBy = 'manual') {
  if (coachIds.length !== booking.coachesRequired) {
    const error = new Error(`This booking requires ${booking.coachesRequired} instructor(s)`);
    error.status = 400;
    throw error;
  }

  const uniqueIds = [...new Set(coachIds.map(String))];
  if (uniqueIds.length !== coachIds.length) {
    const error = new Error('Cannot assign duplicate instructors');
    error.status = 400;
    throw error;
  }

  const coaches = await Instructor.find({ _id: { $in: coachIds }, active: true });
  if (coaches.length !== coachIds.length) {
    const error = new Error('Some instructors were not found or are inactive');
    error.status = 400;
    throw error;
  }

  for (const coach of coaches) {
    const dayCheck = await coachPassesAllLessonDays(coach, booking);
    if (!dayCheck.ok) {
      const error = new Error(dayCheck.reason);
      error.status = 400;
      throw error;
    }
  }

  booking.assignedCoaches = coaches.map((instructor) => ({
    coach: instructor._id,
    assignmentScore: scoreCoach(instructor, booking),
    assignedBy,
    assignedAt: new Date(),
  }));
  booking.status = 'assigned';
  await booking.save();

  return booking.populate('assignedCoaches.coach', 'name phone email specialties');
}

async function assignCoaches(bookingId, coachIds, assignedBy = 'manual') {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.status = 404;
    throw error;
  }

  if (booking.status !== 'confirmed') {
    const error = new Error('Only confirmed bookings can be assigned');
    error.status = 400;
    throw error;
  }

  return applyCoachAssignment(booking, coachIds, assignedBy);
}

async function reassignCoaches(bookingId, coachIds, assignedBy = 'manual') {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.status = 404;
    throw error;
  }

  if (!['assigned', 'needs_attention'].includes(booking.status)) {
    const error = new Error('Only assigned or needs-attention bookings can be reassigned');
    error.status = 400;
    throw error;
  }

  return applyCoachAssignment(booking, coachIds, assignedBy);
}

async function resolveBooking(bookingId, { adminNotes } = {}) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.status = 404;
    throw error;
  }

  if (booking.status !== 'needs_attention') {
    const error = new Error('Only needs-attention bookings can be resolved');
    error.status = 400;
    throw error;
  }

  booking.status = 'confirmed';
  booking.assignedCoaches = [];
  if (adminNotes !== undefined) booking.adminNotes = adminNotes;
  await booking.save();

  return booking;
}

async function autoAssignCoaches(bookingId) {
  const suggestion = await suggestCoachesForBooking(bookingId);

  if (!suggestion.canAutoAssign) {
    const error = new Error(
      `Cannot auto-assign: need ${suggestion.instructorsRequired} instructor(s), only ${suggestion.suggestions.length} eligible found`
    );
    error.status = 400;
    throw error;
  }

  const coachIds = suggestion.suggestions.map((s) => s.instructorId);
  return assignCoaches(bookingId, coachIds, 'auto');
}

async function autoReassignCoaches(bookingId) {
  const suggestion = await suggestCoachesForBooking(bookingId, { forReassign: true });

  if (!suggestion.canAutoAssign) {
    const error = new Error(
      `Cannot auto-reassign: need ${suggestion.instructorsRequired} instructor(s), only ${suggestion.suggestions.length} eligible found`
    );
    error.status = 400;
    throw error;
  }

  const coachIds = suggestion.suggestions.map((s) => s.instructorId);
  return reassignCoaches(bookingId, coachIds, 'auto');
}

module.exports = {
  calculateCoachesRequired,
  suggestCoachesForBooking,
  assignCoaches,
  reassignCoaches,
  resolveBooking,
  autoAssignCoaches,
  autoReassignCoaches,
  getAvailableCoachesForBooking,
  coachPassesAllLessonDays,
  scoreCoach,
  findTimeConflict,
};
