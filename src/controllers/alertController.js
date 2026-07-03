const alertService = require('../services/alertService');

async function listAlerts(req, res, next) {
  try {
    const data = await alertService.getAllAlerts();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAlerts };
