const Booking = require('../models/Booking');
const Coach = require('../models/Coach');
const { calculateCoachesRequired } = require('../utils/coachRequirement');
const { bookingsOverlap, formatTimeRange } = require('../utils/timeOverlap');
const { isCoachOnFullDayLeave, isCoachBlockedForBooking } = require('../utils/leavePeriods');

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
        breakdown.push({ factor: 'Mainland coach requested', points: 20 });
      } else {
        score -= 10;
        breakdown.push({ factor: 'Not a mainland coach', points: -10 });
      }
    }
  }

  const skillPts = coach.skillLevel * 3;
  score += skillPts;
  breakdown.push({ factor: `Skill level (${coach.skillLevel}/5)`, points: skillPts });

  const heatPts = HEAT_SCORE[coach.heatLevel] || 0;
  score += heatPts;
  breakdown.push({ factor: `Teaching heat (${coach.heatLevel})`, points: heatPts });

  return { score, breakdown };
}

function scoreCoach(coach, booking) {
  return scoreCoachWithBreakdown(coach, booking).score;
}

async function getCoachBookingsOnDate(coachId, lessonDate, excludeBookingId = null) {
  const start = new Date(lessonDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(lessonDate);
  end.setHours(23, 59, 59, 999);

  const filter = {
    status: { $in: ['confirmed', 'assigned', 'completed', 'needs_attention'] },
    lessonDate: { $gte: start, $lte: end },
    'assignedCoaches.coach': coachId,
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };

  return Booking.find(filter);
}

async function findTimeConflict(coachId, booking, excludeBookingId = null) {
  const existing = await getCoachBookingsOnDate(coachId, booking.lessonDate, excludeBookingId);
  return existing.find((b) => bookingsOverlap(booking, b)) || null;
}

async function getDailyLessonCount(coachId, lessonDate) {
  const bookings = await getCoachBookingsOnDate(coachId, lessonDate);
  return bookings.length;
}

function isCoachBlockedOnDate(coach, lessonDate) {
  return isCoachOnFullDayLeave(coach, lessonDate);
}

function isCoachAvailableOnDay(coach, lessonDate) {
  const dayOfWeek = new Date(lessonDate).getDay();
  const entry = coach.weeklyAvailability.find((a) => a.dayOfWeek === dayOfWeek);
  if (entry) return entry.available;
  return true;
}

async function getAvailableCoachesForBooking(booking, { excludeCoachIds = [], forReassign = false } = {}) {
  const coaches = await Coach.find({ active: true });
  const eligible = [];
  const excluded = new Set(excludeCoachIds.map(String));

  for (const coach of coaches) {
    if (excluded.has(coach._id.toString())) continue;
    if (!coach.specialties.includes(booking.lessonType)) continue;
    if (isCoachBlockedForBooking(coach, booking)) continue;
    if (!isCoachAvailableOnDay(coach, booking.lessonDate)) continue;

    const dailyCount = await getDailyLessonCount(coach._id, booking.lessonDate);
    if (dailyCount >= coach.maxDailyLessons) continue;

    const conflict = await findTimeConflict(coach._id, booking, booking._id);
    if (conflict) continue;

    const alreadyAssigned = booking.assignedCoaches?.some(
      (a) => a.coach.toString() === coach._id.toString()
    );
    if (!forReassign && alreadyAssigned) continue;

    const { score, breakdown } = scoreCoachWithBreakdown(coach, booking);
    const workloadPenalty = dailyCount * 5;
    const finalScore = score - workloadPenalty;

    eligible.push({
      coach,
      score: finalScore,
      baseScore: score,
      breakdown: [
        ...breakdown,
        ...(dailyCount > 0
          ? [{ factor: `${dailyCount} lesson(s) already today`, points: -workloadPenalty }]
          : []),
      ],
      dailyLessonCount: dailyCount,
    });
  }

  eligible.sort((a, b) => b.score - a.score);
  return eligible;
}

function mapCoachSuggestion(item) {
  return {
    coachId: item.coach._id,
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

  if (booking.coachesRequired === 2 && eligible.length >= 2) {
    const first = eligible[0];
    suggestions.push(mapCoachSuggestion(first));
    const secondPool = await getAvailableCoachesForBooking(booking, {
      excludeCoachIds: [first.coach._id],
    });
    if (secondPool.length) suggestions.push(mapCoachSuggestion(secondPool[0]));
  } else {
    eligible.slice(0, booking.coachesRequired).forEach((item) => {
      suggestions.push(mapCoachSuggestion(item));
    });
  }

  return {
    bookingId: booking._id,
    coachesRequired: booking.coachesRequired,
    canAutoAssign: suggestions.length >= booking.coachesRequired,
    suggestions,
    allEligible: eligible.map((item) => ({
      coachId: item.coach._id,
      name: item.coach.name,
      score: item.score,
    })),
  };
}

async function applyCoachAssignment(booking, coachIds, assignedBy = 'manual') {
  if (coachIds.length !== booking.coachesRequired) {
    const error = new Error(`This booking requires ${booking.coachesRequired} coach(es)`);
    error.status = 400;
    throw error;
  }

  const uniqueIds = [...new Set(coachIds.map(String))];
  if (uniqueIds.length !== coachIds.length) {
    const error = new Error('Cannot assign duplicate coaches');
    error.status = 400;
    throw error;
  }

  const coaches = await Coach.find({ _id: { $in: coachIds }, active: true });
  if (coaches.length !== coachIds.length) {
    const error = new Error('Some coaches were not found or are inactive');
    error.status = 400;
    throw error;
  }

  for (const coach of coaches) {
    if (isCoachBlockedForBooking(coach, booking)) {
      const error = new Error(`${coach.name} is on leave during this lesson time`);
      error.status = 400;
      throw error;
    }
    const conflict = await findTimeConflict(coach._id, booking, booking._id);
    if (conflict) {
      const error = new Error(
        `${coach.name} has a schedule conflict at ${formatTimeRange(booking)} with ${conflict.guestName} (${formatTimeRange(conflict)})`
      );
      error.status = 400;
      throw error;
    }
  }

  booking.assignedCoaches = coaches.map((coach) => ({
    coach: coach._id,
    assignmentScore: scoreCoach(coach, booking),
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
      `Cannot auto-assign: need ${suggestion.coachesRequired} coach(es), only ${suggestion.suggestions.length} eligible found`
    );
    error.status = 400;
    throw error;
  }

  const coachIds = suggestion.suggestions.map((s) => s.coachId);
  return assignCoaches(bookingId, coachIds, 'auto');
}

async function autoReassignCoaches(bookingId) {
  const suggestion = await suggestCoachesForBooking(bookingId, { forReassign: true });

  if (!suggestion.canAutoAssign) {
    const error = new Error(
      `Cannot auto-reassign: need ${suggestion.coachesRequired} coach(es), only ${suggestion.suggestions.length} eligible found`
    );
    error.status = 400;
    throw error;
  }

  const coachIds = suggestion.suggestions.map((s) => s.coachId);
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
  scoreCoach,
  findTimeConflict,
};
