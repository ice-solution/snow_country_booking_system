const resortConfigService = require('../services/resortConfigService');

async function getResorts(req, res, next) {
  try {
    const resorts = await resortConfigService.getResortsForAdmin();
    res.json({ success: true, data: { resorts } });
  } catch (err) {
    next(err);
  }
}

async function updateResorts(req, res, next) {
  try {
    const resorts = await resortConfigService.updateResorts(req.body.resorts, req.body.updatedBy);
    res.json({ success: true, data: { resorts }, message: 'Resorts updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getResorts, updateResorts };
