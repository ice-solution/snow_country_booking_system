const ganttService = require('../services/ganttService');

async function getGantt(req, res, next) {
  try {
    const { date, instructorId, headOnly } = req.query;
    const data = await ganttService.getGantt({
      date,
      instructorId: instructorId || req.query.coachId,
      headOnly: headOnly === 'true' || headOnly === '1',
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getInstructorSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const data = await ganttService.getInstructorSchedule(id, { from, to });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getInstructorGanttView(req, res, next) {
  try {
    const instructorId = req.instructorId;
    const { date } = req.query;
    const schedule = await ganttService.getInstructorSchedule(instructorId, { from: date, to: date });
    const gantt = await ganttService.getGantt({ date, instructorId });
    const leaveBlocks = gantt.rows[0]?.leaveBlocks || [];
    res.json({
      success: true,
      data: {
        instructor: schedule.instructor,
        gantt: {
          date: gantt.date,
          timeSlots: gantt.timeSlots,
          blocks: schedule.byDate[gantt.date] || [],
          leaveBlocks,
          locations: gantt.locations,
        },
        upcoming: schedule.bookings,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getInstructorScheduleView(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await ganttService.getInstructorSchedule(req.instructorId, { from, to });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getInstructorDayOverview(req, res, next) {
  try {
    const { date } = req.query;
    const data = await ganttService.getGantt({ date });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getGantt,
  getInstructorSchedule,
  getInstructorGanttView,
  getInstructorScheduleView,
  getInstructorDayOverview,
};
