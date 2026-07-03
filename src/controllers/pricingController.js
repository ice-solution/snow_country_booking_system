const catalogService = require('../services/catalogService');

async function getPricing(req, res, next) {
  try {
    const table = await catalogService.getPricingTable();
    res.json({ success: true, data: table });
  } catch (err) {
    next(err);
  }
}

async function updatePricing(req, res, next) {
  try {
    const { regions, resorts, regionPrices } = req.body;

    if (Array.isArray(regions) && regions.length) {
      const table = await catalogService.saveCatalog({ regions, resorts: resorts || [] }, 'admin');
      return res.json({
        success: true,
        message: 'Pricing & resorts updated',
        data: table,
      });
    }

    if (regionPrices && typeof regionPrices === 'object') {
      const catalog = await catalogService.loadCatalog();
      const mergedRegions = catalog.regions.map((r) => ({
        ...r,
        prices: regionPrices[r.id] || r.prices,
      }));
      const table = await catalogService.saveCatalog(
        { regions: mergedRegions, resorts: catalog.allResorts },
        'admin'
      );
      return res.json({
        success: true,
        message: 'Pricing & resorts updated',
        data: table,
      });
    }

    return res.status(400).json({ success: false, message: 'regions or regionPrices is required' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPricing, updatePricing };
