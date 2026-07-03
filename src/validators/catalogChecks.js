const catalogService = require('../services/catalogService');

async function isValidResortId(value) {
  if (!value) return false;
  const ids = await catalogService.getResortIds(true);
  return ids.includes(value);
}

async function isValidRegionId(value) {
  if (!value) return false;
  const ids = await catalogService.getRegionIds();
  return ids.includes(value);
}

module.exports = { isValidResortId, isValidRegionId };
