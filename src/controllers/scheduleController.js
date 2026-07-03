const scheduleService = require('../services/scheduleService');

async function getSchedule(req, res, next) {
  try {
    const { from, to, coachId } = req.query;
    const data = await scheduleService.getSchedule({ from, to, coachId });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSchedule };
