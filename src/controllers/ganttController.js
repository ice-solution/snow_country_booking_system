const ganttService = require('../services/ganttService');

async function getGantt(req, res, next) {
  try {
    const { date, coachId, headOnly } = req.query;
    const data = await ganttService.getGantt({
      date,
      coachId,
      headOnly: headOnly === 'true' || headOnly === '1',
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getCoachSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const data = await ganttService.getCoachSchedule(id, { from, to });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getCoachGanttView(req, res, next) {
  try {
    const { coachId } = req.params;
    const { date } = req.query;
    const schedule = await ganttService.getCoachSchedule(coachId, { from: date, to: date });
    const gantt = await ganttService.getGantt({ date, coachId });
    const leaveBlocks = gantt.rows[0]?.leaveBlocks || [];
    res.json({
      success: true,
      data: {
        coach: schedule.coach,
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

module.exports = { getGantt, getCoachSchedule, getCoachGanttView };
