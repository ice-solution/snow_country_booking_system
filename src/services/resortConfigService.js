const catalogService = require('./catalogService');

module.exports = {
  getMergedResorts: async () => {
    const catalog = await catalogService.loadCatalog();
    return catalog.allResorts;
  },
  getResortMap: () => catalogService.getResortMap(),
  getResort: (id) => catalogService.getResort(id),
  getResortsConfig: () => catalogService.getResortsConfig(),
  getResortsForAdmin: async () => {
    const catalog = await catalogService.loadCatalog();
    return catalog.allResorts;
  },
  updateResorts: async (resorts, updatedBy) => {
    const catalog = await catalogService.loadCatalog();
    const regions = catalog.regions.map((r) => ({
      id: r.id,
      name: r.name,
      nameEn: r.nameEn,
      description: r.description,
      prices: r.prices,
    }));
    return catalogService.saveCatalog({ regions, resorts }, updatedBy);
  },
  invalidateResortCache: () => catalogService.invalidateCatalogCache(),
};
