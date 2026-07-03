const catalogService = require('./catalogService');

module.exports = {
  getPricingTable: () => catalogService.getPricingTable(),
  getRegionPricesMap: () => catalogService.getRegionPricesMap(),
  getPricingRegion: (id) => catalogService.getPricingRegion(id),
  calculatePrice: (...args) => catalogService.calculatePrice(...args),
  invalidatePricingCache: () => catalogService.invalidateCatalogCache(),
  updateRegionPrices: async () => {
    throw new Error('Use catalogService.saveCatalog instead');
  },
};
