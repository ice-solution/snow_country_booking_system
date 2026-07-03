const { getDailyCapacity, getCapacityRange } = require('../services/capacityService');

async function getCapacity(req, res, next) {
  try {
    const { date, from, to, headOnly } = req.query;
    const head = headOnly === 'true' || headOnly === '1';
    const options = { headOnly: head };

    if (from && to) {
      const days = await getCapacityRange(from, to, options);
      return res.json({ success: true, data: { days } });
    }

    if (!date) {
      return res.status(400).json({ success: false, message: 'date or from/to required' });
    }

    const data = await getDailyCapacity(date, options);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCapacity };
