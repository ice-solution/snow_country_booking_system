const Booking = require('../models/Booking');
const Instructor = require('../models/Instructor');
const { bookingsOverlapOnDay } = require('../utils/timeOverlap');
const { isInstructorBlockedForBookingOnDate } = require('../utils/leavePeriods');
const {
  getLessonDays,
  getLessonDayCount,
  mongoOverlapsDay,
  bookingOverlapsDay,
  toIsoDate,
} = require('../utils/lessonDateRange');

const HEAT_SCORE = { high: 10, medium: 5, low: 2 };

function scoreInstructorWithBreakdown(instructor, booking) {
  const breakdown = [];
  let score = 0;

  if (instructor.specialties.includes(booking.lessonType)) {
    score += 30;
    breakdown.push({ factor: 'Specialty match', points: 30 });
  } else {
    breakdown.push({ factor: 'Specialty mismatch', points: 0 });
  }

  if (booking.languagePref === 'any' || instructor.languages.includes(booking.languagePref)) {
    score += 25;
    breakdown.push({ factor: 'Language match', points: 25 });
  } else {
    breakdown.push({ factor: 'Language mismatch', points: 0 });
  }

  if (booking.specialRequests) {
    const requests = booking.specialRequests.toLowerCase();
    if (requests.includes('內地') || requests.includes('mainland')) {
      if (instructor.isMainland) {
        score += 20;
        breakdown.push({ factor: 'Mainland instructor requested', points: 20 });
      } else {
        score -= 10;
        breakdown.push({ factor: 'Not a mainland instructor', points: -10 });
      }
    }
  }

  const skillPts = instructor.skillLevel * 3;
  score += skillPts;
  breakdown.push({ factor: `Skill level (${instructor.skillLevel}/5)`, points: skillPts });

  const heatPts = HEAT_SCORE[instructor.heatLevel] || 0;
  score += heatPts;
  breakdown.push({ factor: `Teaching heat (${instructor.heatLevel})`, points: heatPts });

  const dayCount = getLessonDayCount(booking);
  if (dayCount > 1) {
    breakdown.push({ factor: `${dayCount}-slot booking`, points: 0 });
  }

  return { score, breakdown };
}

function scoreInstructor(instructor, booking) {
  return scoreInstructorWithBreakdown(instructor, booking).score;
}

async function getInstructorBookingsOnDate(instructorId, lessonDate, excludeBookingId = null) {
  const filter = {
    status: { $in: ['confirmed', 'assigned', 'completed', 'needs_attention'] },
    ...mongoOverlapsDay(lessonDate),
    'assignedInstructors.instructor': instructorId,
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };

  const bookings = await Booking.find(filter);
  return bookings.filter((b) => bookingOverlapsDay(b, lessonDate));
}

async function findTimeConflict(instructorId, booking, day, excludeBookingId = null) {
  const existing = await getInstructorBookingsOnDate(instructorId, day, excludeBookingId);
  return existing.find((b) => bookingsOverlapOnDay(booking, b, day)) || null;
}

async function getDailyLessonCount(instructorId, lessonDate, excludeBookingId = null) {
  const bookings = await getInstructorBookingsOnDate(instructorId, lessonDate, excludeBookingId);
  return bookings.length;
}

function isInstructorAvailableOnDay(instructor, lessonDate) {
  const dayOfWeek = new Date(lessonDate).getDay();
  const entry = instructor.weeklyAvailability.find((a) => a.dayOfWeek === dayOfWeek);
  if (entry) return entry.available;
  return true;
}

async function instructorPassesAllLessonDays(instructor, booking, { forReassign = false } = {}) {
  const days = getLessonDays(booking);
  let maxDailyCount = 0;

  for (const day of days) {
    if (isInstructorBlockedForBookingOnDate(instructor, booking, day)) {
      return { ok: false, reason: `${instructor.name} is on leave on ${toIsoDate(day)}` };
    }
    if (!isInstructorAvailableOnDay(instructor, day)) {
      return { ok: false, reason: `${instructor.name} is not available on ${toIsoDate(day)}` };
    }

    const dailyCount = await getDailyLessonCount(instructor._id, day, booking._id);
    maxDailyCount = Math.max(maxDailyCount, dailyCount);
    if (dailyCount >= instructor.maxDailyLessons) {
      return {
        ok: false,
        reason: `${instructor.name} already has ${dailyCount} lesson(s) on ${toIsoDate(day)} (max ${instructor.maxDailyLessons})`,
      };
    }

    const conflict = await findTimeConflict(instructor._id, booking, day, booking._id);
    if (conflict) {
      return {
        ok: false,
        reason: `${instructor.name} has a schedule conflict on ${toIsoDate(day)} with ${conflict.guestName}`,
      };
    }
  }

  const alreadyAssigned = booking.assignedInstructors?.some(
    (a) => a.instructor.toString() === instructor._id.toString()
  );
  if (!forReassign && alreadyAssigned) {
    return { ok: false, reason: `${instructor.name} is already assigned` };
  }

  return { ok: true, maxDailyCount };
}

async function getAvailableInstructorsForBooking(
  booking,
  { excludeInstructorIds = [], forReassign = false } = {}
) {
  const instructors = await Instructor.find({ active: true });
  const eligible = [];
  const excluded = new Set(excludeInstructorIds.map(String));

  for (const instructor of instructors) {
    if (excluded.has(instructor._id.toString())) continue;
    if (!instructor.specialties.includes(booking.lessonType)) continue;

    const dayCheck = await instructorPassesAllLessonDays(instructor, booking, { forReassign });
    if (!dayCheck.ok) continue;

    const { score, breakdown } = scoreInstructorWithBreakdown(instructor, booking);
    const workloadPenalty = (dayCheck.maxDailyCount || 0) * 5;
    const finalScore = score - workloadPenalty;

    eligible.push({
      instructor,
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
    instructorId: item.instructor._id,
    name: item.instructor.name,
    score: item.score,
    breakdown: item.breakdown,
    specialties: item.instructor.specialties,
    languages: item.instructor.languages,
    isMainland: item.instructor.isMainland,
    heatLevel: item.instructor.heatLevel,
    skillLevel: item.instructor.skillLevel,
    dailyLessonCount: item.dailyLessonCount,
  };
}

async function suggestInstructorsForBooking(bookingId, { forReassign = false } = {}) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.status = 404;
    throw error;
  }

  const eligible = await getAvailableInstructorsForBooking(booking, { forReassign });
  const suggestions = [];
  const required = booking.instructorsRequired;

  if (required === 2 && eligible.length >= 2) {
    const first = eligible[0];
    suggestions.push(mapInstructorSuggestion(first));
    const secondPool = await getAvailableInstructorsForBooking(booking, {
      excludeInstructorIds: [first.instructor._id],
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
      instructorId: item.instructor._id,
      name: item.instructor.name,
      score: item.score,
    })),
  };
}

async function applyInstructorAssignment(booking, instructorIds, assignedBy = 'manual') {
  if (instructorIds.length !== booking.instructorsRequired) {
    const error = new Error(`This booking requires ${booking.instructorsRequired} instructor(s)`);
    error.status = 400;
    throw error;
  }

  const uniqueIds = [...new Set(instructorIds.map(String))];
  if (uniqueIds.length !== instructorIds.length) {
    const error = new Error('Cannot assign duplicate instructors');
    error.status = 400;
    throw error;
  }

  const instructors = await Instructor.find({ _id: { $in: instructorIds }, active: true });
  if (instructors.length !== instructorIds.length) {
    const error = new Error('Some instructors were not found or are inactive');
    error.status = 400;
    throw error;
  }

  for (const instructor of instructors) {
    const dayCheck = await instructorPassesAllLessonDays(instructor, booking);
    if (!dayCheck.ok) {
      const error = new Error(dayCheck.reason);
      error.status = 400;
      throw error;
    }
  }

  booking.assignedInstructors = instructors.map((instructor) => ({
    instructor: instructor._id,
    assignmentScore: scoreInstructor(instructor, booking),
    assignedBy,
    assignedAt: new Date(),
  }));
  booking.status = 'assigned';
  await booking.save();

  return booking.populate('assignedInstructors.instructor', 'name phone email specialties');
}

async function assignInstructors(bookingId, instructorIds, assignedBy = 'manual') {
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

  return applyInstructorAssignment(booking, instructorIds, assignedBy);
}

async function reassignInstructors(bookingId, instructorIds, assignedBy = 'manual') {
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

  return applyInstructorAssignment(booking, instructorIds, assignedBy);
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
  booking.assignedInstructors = [];
  if (adminNotes !== undefined) booking.adminNotes = adminNotes;
  await booking.save();

  return booking;
}

async function autoAssignInstructors(bookingId) {
  const suggestion = await suggestInstructorsForBooking(bookingId);

  if (!suggestion.canAutoAssign) {
    const error = new Error(
      `Cannot auto-assign: need ${suggestion.instructorsRequired} instructor(s), only ${suggestion.suggestions.length} eligible found`
    );
    error.status = 400;
    throw error;
  }

  const instructorIds = suggestion.suggestions.map((s) => s.instructorId);
  return assignInstructors(bookingId, instructorIds, 'auto');
}

async function autoReassignInstructors(bookingId) {
  const suggestion = await suggestInstructorsForBooking(bookingId, { forReassign: true });

  if (!suggestion.canAutoAssign) {
    const error = new Error(
      `Cannot auto-reassign: need ${suggestion.instructorsRequired} instructor(s), only ${suggestion.suggestions.length} eligible found`
    );
    error.status = 400;
    throw error;
  }

  const instructorIds = suggestion.suggestions.map((s) => s.instructorId);
  return reassignInstructors(bookingId, instructorIds, 'auto');
}

module.exports = {
  suggestInstructorsForBooking,
  assignInstructors,
  reassignInstructors,
  resolveBooking,
  autoAssignInstructors,
  autoReassignInstructors,
  getAvailableInstructorsForBooking,
  instructorPassesAllLessonDays,
  scoreInstructor,
  findTimeConflict,
};
