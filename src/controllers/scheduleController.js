const scheduleService = require('../services/scheduleService');
const scheduleMoveService = require('../services/scheduleMoveService');

async function getSchedule(req, res, next) {
  try {
    const { from, to, coachId } = req.query;
    const data = await scheduleService.getSchedule({ from, to, coachId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getScheduleBoard(req, res, next) {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'from and to are required' });
    }
    const data = await scheduleMoveService.getScheduleBoard({ from, to });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSchedule, getScheduleBoard };
