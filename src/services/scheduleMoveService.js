const Booking = require('../models/Booking');
const Instructor = require('../models/Instructor');
const {
  getLessonSlots,
  toIsoDate,
  normalizeLessonDate,
  syncBookingLessonDates,
} = require('../utils/lessonDateRange');
const {
  coachPassesAllLessonDays,
  scoreCoach,
} = require('./assignmentService');

function materializeSlots(booking) {
  const slots = getLessonSlots(booking).map((s) => ({
    date: s.date,
    startTime: s.startTime,
    durationHours: s.durationHours,
  }));
  booking.lessonSlots = slots;
  syncBookingLessonDates(booking);
  return slots;
}

function findSlotIndex(slots, { slotIndex, fromDate, fromStartTime }) {
  const idx = slotIndex !== undefined && slotIndex !== null ? Number(slotIndex) : NaN;
  if (Number.isInteger(idx) && idx >= 0 && idx < slots.length) {
    return idx;
  }
  if (!fromDate) {
    const error = new Error('slotIndex or fromDate is required');
    error.status = 400;
    throw error;
  }
  const fromKey = toIsoDate(fromDate);
  const matches = slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => toIsoDate(s.date) === fromKey)
    .filter(({ s }) => !fromStartTime || s.startTime === fromStartTime);

  if (!matches.length) {
    const error = new Error('Lesson timeslot not found on that date');
    error.status = 404;
    throw error;
  }
  if (matches.length > 1 && !fromStartTime) {
    const error = new Error('Multiple timeslots on that date — provide fromStartTime or slotIndex');
    error.status = 400;
    throw error;
  }
  return matches[0].i;
}

function replaceInstructor(assigned, fromInstructorId, toInstructorId) {
  const list = (assigned || []).map((a) => ({
    coach: a.coach?._id || a.coach,
    assignmentScore: a.assignmentScore,
    assignedBy: a.assignedBy || 'admin',
    assignedAt: a.assignedAt || new Date(),
  }));

  const toId = String(toInstructorId);
  if (list.some((a) => String(a.coach) === toId)) {
    const error = new Error('Target instructor is already assigned to this booking');
    error.status = 400;
    throw error;
  }

  if (fromInstructorId) {
    const fromId = String(fromInstructorId);
    const idx = list.findIndex((a) => String(a.coach) === fromId);
    if (idx === -1) {
      const error = new Error('Source instructor is not assigned to this booking');
      error.status = 400;
      throw error;
    }
    list[idx] = {
      coach: toInstructorId,
      assignmentScore: undefined,
      assignedBy: 'admin-drag',
      assignedAt: new Date(),
    };
    return list;
  }

  if (list.length === 1) {
    list[0] = {
      coach: toInstructorId,
      assignmentScore: undefined,
      assignedBy: 'admin-drag',
      assignedAt: new Date(),
    };
    return list;
  }

  if (!list.length) {
    return [
      {
        coach: toInstructorId,
        assignmentScore: undefined,
        assignedBy: 'admin-drag',
        assignedAt: new Date(),
      },
    ];
  }

  const error = new Error(
    'This booking has multiple instructors — specify fromInstructorId when moving to another instructor'
  );
  error.status = 400;
  throw error;
}

async function validateInstructorsForBooking(booking, coachIds) {
  const coaches = await Instructor.find({ _id: { $in: coachIds }, active: true });
  if (coaches.length !== coachIds.length) {
    const error = new Error('Some instructors were not found or are inactive');
    error.status = 400;
    throw error;
  }
  for (const coach of coaches) {
    const dayCheck = await coachPassesAllLessonDays(coach, booking, { forReassign: true });
    if (!dayCheck.ok) {
      const error = new Error(dayCheck.reason);
      error.status = 400;
      throw error;
    }
  }
  return coaches;
}

/**
 * Move a single lesson timeslot to another date/time and/or instructor.
 * Does not shift the whole booking — only the targeted slot.
 */
async function moveLessonSlot(bookingId, body = {}) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.status = 404;
    throw error;
  }

  if (['completed', 'cancelled'].includes(booking.status)) {
    const error = new Error('Completed or cancelled bookings cannot be moved');
    error.status = 400;
    throw error;
  }

  if (!body.toDate) {
    const error = new Error('toDate is required');
    error.status = 400;
    throw error;
  }

  const slots = materializeSlots(booking);
  const index = findSlotIndex(slots, body);
  const slot = slots[index];

  const nextDate = normalizeLessonDate(body.toDate);
  const nextStart = body.toStartTime || slot.startTime;
  const nextDuration = body.toDurationHours
    ? Number(body.toDurationHours)
    : slot.durationHours;

  slots[index] = {
    date: nextDate,
    startTime: nextStart,
    durationHours: nextDuration,
  };

  // sort by date/time
  slots.sort((a, b) => {
    const d = a.date - b.date;
    if (d !== 0) return d;
    return String(a.startTime).localeCompare(String(b.startTime));
  });

  booking.lessonSlots = slots;
  syncBookingLessonDates(booking);
  booking.lessonStartTime = slots[0].startTime;
  booking.durationHours = slots[0].durationHours;

  const toInstructorId = body.toInstructorId || null;
  const fromInstructorId = body.fromInstructorId || null;

  if (toInstructorId) {
    if (booking.coachesRequired > 1 && !fromInstructorId && (booking.assignedCoaches || []).length > 1) {
      const error = new Error(
        'This booking needs multiple instructors — drag from a specific instructor row (fromInstructorId required)'
      );
      error.status = 400;
      throw error;
    }

    if (booking.status === 'pending') {
      const error = new Error('Confirm the booking before assigning an instructor via drag & drop');
      error.status = 400;
      throw error;
    }

    let nextAssigned;
    if (
      booking.status === 'confirmed' ||
      !(booking.assignedCoaches || []).length
    ) {
      if (booking.coachesRequired !== 1) {
        const error = new Error(
          `This booking requires ${booking.coachesRequired} instructors — assign from booking detail first`
        );
        error.status = 400;
        throw error;
      }
      nextAssigned = [
        {
          coach: toInstructorId,
          assignedBy: 'admin-drag',
          assignedAt: new Date(),
        },
      ];
    } else {
      nextAssigned = replaceInstructor(booking.assignedCoaches, fromInstructorId, toInstructorId);
    }

    const coachIds = nextAssigned.map((a) => a.coach);
    if (coachIds.length !== booking.coachesRequired) {
      const error = new Error(
        `This booking requires ${booking.coachesRequired} instructor(s) after the move`
      );
      error.status = 400;
      throw error;
    }

    const coaches = await validateInstructorsForBooking(booking, coachIds);
    const byId = Object.fromEntries(coaches.map((c) => [String(c._id), c]));
    booking.assignedCoaches = nextAssigned.map((a) => ({
      coach: a.coach,
      assignmentScore: scoreCoach(byId[String(a.coach)], booking),
      assignedBy: a.assignedBy || 'admin-drag',
      assignedAt: a.assignedAt || new Date(),
    }));
    booking.status = 'assigned';
  } else if ((booking.assignedCoaches || []).length) {
    // Date-only move: still validate assigned instructors against new slots
    const coachIds = booking.assignedCoaches.map((a) => a.coach?._id || a.coach);
    await validateInstructorsForBooking(booking, coachIds);
  }

  await booking.save();
  return booking.populate('assignedCoaches.coach', 'name phone email specialties');
}

/**
 * Flatten bookings in a date range into per-slot board cards for the schedule editor.
 */
async function getScheduleBoard({ from, to }) {
  const start = normalizeLessonDate(from);
  const end = normalizeLessonDate(to);
  end.setHours(23, 59, 59, 999);

  const [instructors, bookings] = await Promise.all([
    Instructor.find({ active: true }).sort({ name: 1 }).select('name specialties active'),
    Booking.find({
      status: { $in: ['pending', 'confirmed', 'assigned', 'needs_attention'] },
      lessonDateFrom: { $lte: end },
      lessonDateTo: { $gte: start },
    })
      .populate('assignedCoaches.coach', 'name')
      .sort({ lessonDateFrom: 1, lessonStartTime: 1 }),
  ]);

  const dates = [];
  const cursor = new Date(start);
  const endDay = normalizeLessonDate(to);
  while (cursor <= endDay) {
    dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const cards = [];
  for (const booking of bookings) {
    const slots = getLessonSlots(booking);
    slots.forEach((slot, slotIndex) => {
      const dateKey = toIsoDate(slot.date);
      if (dateKey < dates[0] || dateKey > dates[dates.length - 1]) return;

      const assigned = (booking.assignedCoaches || []).map((a) => ({
        instructorId: a.coach?._id || a.coach,
        name: a.coach?.name || '',
      }));

      cards.push({
        bookingId: booking._id,
        slotIndex,
        date: dateKey,
        startTime: slot.startTime,
        durationHours: slot.durationHours,
        guestName: booking.guestName,
        lessonType: booking.lessonType,
        resortLocation: booking.resortLocation,
        region: booking.region,
        status: booking.status,
        instructorsRequired: booking.coachesRequired,
        assignedInstructors: assigned,
        hasMultipleSlots: slots.length > 1,
        slotCount: slots.length,
      });
    });
  }

  return { from: dates[0], to: dates[dates.length - 1], dates, instructors, cards };
}

module.exports = {
  moveLessonSlot,
  getScheduleBoard,
  materializeSlots,
};
