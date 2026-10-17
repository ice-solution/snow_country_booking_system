const PricingConfig = require('../models/PricingConfig');
const ResortConfig = require('../models/ResortConfig');
const {
  CURRENCY,
  PRICING_REGIONS,
  REGION_IDS,
  RESORTS,
  PRICING_NOTE,
} = require('../config/resorts');

let cache = null;
let cacheTime = 0;
const CACHE_MS = 3000;

const DEFAULT_PRICES = { 3: 32000, 4: 46000, 5: 52000, 6: 62000 };

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || `item_${Date.now()}`;
}

function uniqueId(base, used) {
  let id = slugify(base);
  if (!used.has(id)) return id;
  let n = 2;
  while (used.has(`${id}_${n}`)) n += 1;
  return `${id}_${n}`;
}

function defaultCatalog() {
  const regions = REGION_IDS.map((id) => ({
    id,
    name: PRICING_REGIONS[id].name,
    nameEn: PRICING_REGIONS[id].nameEn || PRICING_REGIONS[id].name,
    description: PRICING_REGIONS[id].description || '',
    prices: { ...PRICING_REGIONS[id].prices },
  }));

  const resorts = RESORTS.filter((r) => r.id !== 'other').map((r) => ({
    id: r.id,
    name: r.name,
    nameEn: r.nameEn || r.name,
    region: r.region,
    color: r.color || '#D1D5DB',
    active: r.active !== false,
  }));

  return { regions, resorts };
}

function normalizePrices(prices) {
  const out = {};
  for (const h of [3, 4, 5, 6]) {
    const val = Number(prices?.[h]);
    out[h] = Number.isFinite(val) && val >= 0 ? val : DEFAULT_PRICES[h];
  }
  return out;
}

function sanitizeRegion(raw, usedIds) {
  const id = raw.id && !String(raw.id).startsWith('new-') && !String(raw.id).startsWith('new_')
    ? slugify(raw.id)
    : uniqueId(raw.nameEn || raw.name || 'region', usedIds);
  usedIds.add(id);
  return {
    id,
    name: String(raw.name || id).trim(),
    nameEn: String(raw.nameEn || raw.name || id).trim(),
    description: String(raw.description || '').trim(),
    prices: normalizePrices(raw.prices),
  };
}

function sanitizeResort(raw, usedIds, validRegionIds) {
  const region = slugify(raw.region);
  if (!validRegionIds.has(region)) {
    const error = new Error(`Resort "${raw.name}" has invalid region`);
    error.status = 400;
    throw error;
  }
  const id = raw.id && !String(raw.id).startsWith('new-') && !String(raw.id).startsWith('new_')
    ? slugify(raw.id)
    : uniqueId(raw.nameEn || raw.name || 'resort', usedIds);
  usedIds.add(id);
  return {
    id,
    name: String(raw.name || id).trim(),
    nameEn: String(raw.nameEn || raw.name || id).trim(),
    region,
    color: String(raw.color || '#D1D5DB'),
    active: raw.active !== false,
  };
}

async function loadCatalog() {
  if (cache && Date.now() - cacheTime < CACHE_MS) return cache;

  const defaults = defaultCatalog();
  const [pricingDoc, resortDoc] = await Promise.all([
    PricingConfig.findOne({ key: 'default' }),
    ResortConfig.findOne({ key: 'default' }),
  ]);

  let regions = defaults.regions;
  if (pricingDoc?.regions?.length) {
    // Saved catalog is authoritative — missing default regions were intentionally deleted.
    const defaultById = Object.fromEntries(defaults.regions.map((r) => [r.id, r]));
    regions = pricingDoc.regions.map((r) => {
      const base = defaultById[r.id] || {};
      return {
        id: r.id,
        name: r.name || base.name || r.id,
        nameEn: r.nameEn || base.nameEn || r.name || r.id,
        description: r.description ?? base.description ?? '',
        prices: normalizePrices(r.prices || pricingDoc.regionPrices?.[r.id] || base.prices),
      };
    });
  } else if (pricingDoc?.regionPrices) {
    regions = regions.map((r) => ({
      ...r,
      prices: normalizePrices(pricingDoc.regionPrices[r.id] || r.prices),
    }));
  }

  let resorts = defaults.resorts;
  if (resortDoc?.resorts?.length) {
    // Saved catalog is authoritative — missing default resorts were intentionally deleted.
    const defaultById = Object.fromEntries(defaults.resorts.map((r) => [r.id, r]));
    resorts = resortDoc.resorts
      .filter((r) => r.id !== 'other')
      .map((r) => {
        const base = defaultById[r.id] || {};
        return {
          id: r.id,
          name: r.name || base.name || r.id,
          nameEn: r.nameEn || base.nameEn || r.name || r.id,
          region: r.region || base.region,
          color: r.color || base.color || '#D1D5DB',
          active: r.active !== undefined ? r.active : base.active !== false,
        };
      });
  }

  const regionMap = Object.fromEntries(regions.map((r) => [r.id, r]));
  const resortMap = Object.fromEntries(resorts.map((r) => [r.id, r]));

  cache = {
    currency: CURRENCY,
    regions: regions.map((r) => ({
      ...r,
      resorts: resorts.filter((s) => s.region === r.id),
    })),
    resorts: resorts.filter((r) => r.active !== false),
    allResorts: resorts,
    regionMap,
    resortMap,
    note: PRICING_NOTE,
    includes: ['Instructor fee', 'Basic insurance'],
    excludes: ['Lift pass', 'Equipment rental', 'Meals'],
    maxGuestsPerInstructor: 4,
  };
  cacheTime = Date.now();
  return cache;
}

function invalidateCatalogCache() {
  cache = null;
  cacheTime = 0;
}

async function getPricingTable() {
  const catalog = await loadCatalog();
  return {
    currency: catalog.currency,
    regions: catalog.regions,
    resorts: catalog.resorts.map((r) => ({
      id: r.id,
      name: r.name,
      nameEn: r.nameEn,
      region: r.region,
      regionName: catalog.regionMap[r.region]?.name,
      color: r.color,
      active: r.active !== false,
    })),
    note: catalog.note,
    includes: catalog.includes,
    excludes: catalog.excludes,
    maxGuestsPerInstructor: catalog.maxGuestsPerInstructor,
  };
}

async function getRegionIds() {
  const catalog = await loadCatalog();
  return catalog.regions.map((r) => r.id);
}

async function getResortIds(includeInactive = false) {
  const catalog = await loadCatalog();
  const list = includeInactive ? catalog.allResorts : catalog.resorts;
  return list.map((r) => r.id);
}

async function getResort(resortId) {
  const catalog = await loadCatalog();
  return catalog.resortMap[resortId] || catalog.resortMap.other || null;
}

async function getResortMap() {
  const catalog = await loadCatalog();
  return catalog.resortMap;
}

async function getResortsConfig() {
  const catalog = await loadCatalog();
  return catalog.resorts.map((r) => ({
    id: r.id,
    name: r.name,
    nameEn: r.nameEn,
    region: r.region,
    regionName: catalog.regionMap[r.region]?.name,
    color: r.color,
    active: r.active !== false,
  }));
}

async function getRegion(regionId) {
  const catalog = await loadCatalog();
  return catalog.regionMap[regionId] || null;
}

async function getRegionPricesMap() {
  const catalog = await loadCatalog();
  return Object.fromEntries(catalog.regions.map((r) => [r.id, { ...r.prices }]));
}

async function getPricingRegion(regionId) {
  const region = await getRegion(regionId);
  if (!region) return null;
  return {
    id: region.id,
    name: region.name,
    description: region.description,
    prices: region.prices,
  };
}

async function calculatePrice(resortIdOrRegion, durationHours, instructorsRequired) {
  const catalog = await loadCatalog();
  const resort = catalog.resortMap[resortIdOrRegion];
  const regionId = resort?.region || resortIdOrRegion;
  const region = catalog.regionMap[regionId];
  if (!region) {
    const error = new Error('Invalid pricing region');
    error.status = 400;
    throw error;
  }

  const packagePrice = region.prices[durationHours];
  if (!packagePrice) {
    const error = new Error('Invalid duration');
    error.status = 400;
    throw error;
  }

  const instructors = Number(instructorsRequired) || 1;
  return {
    resortLocation: resort?.id || null,
    resortName: resort?.name || null,
    region: regionId,
    regionName: region.name,
    currency: CURRENCY,
    packagePrice,
    instructorsRequired: instructors,
    durationHours,
    totalAmount: packagePrice * instructors,
  };
}

async function applyResortToBooking(payload) {
  const catalog = await loadCatalog();
  const resort = catalog.resortMap[payload.resortLocation];
  if (!resort) {
    const error = new Error('Invalid resort');
    error.status = 400;
    throw error;
  }
  return {
    ...payload,
    resortLocation: resort.id,
    region: resort.region,
  };
}

async function saveCatalog({ regions, resorts }, updatedBy = 'admin') {
  if (!Array.isArray(regions) || !regions.length) {
    const error = new Error('At least one pricing region is required');
    error.status = 400;
    throw error;
  }

  const regionIdMap = new Map();
  const regionIds = new Set();
  const sanitizedRegions = regions.map((raw) => {
    const originalKey = raw.id;
    const sanitized = sanitizeRegion(raw, regionIds);
    regionIdMap.set(originalKey, sanitized.id);
    return sanitized;
  });

  const resortIds = new Set(['other']);
  const sanitizedResorts = (resorts || []).map((raw) => {
    const mappedRegion = regionIdMap.get(raw.region) || slugify(raw.region);
    return sanitizeResort({ ...raw, region: mappedRegion }, resortIds, regionIds);
  });

  sanitizedResorts.push({
    id: 'other',
    name: '待確認',
    nameEn: 'TBC',
    region: sanitizedRegions[0].id,
    color: '#D1D5DB',
    active: false,
  });

  const regionPrices = Object.fromEntries(
    sanitizedRegions.map((r) => [r.id, { ...r.prices }])
  );

  await Promise.all([
    PricingConfig.findOneAndUpdate(
      { key: 'default' },
      {
        regions: sanitizedRegions.map(({ id, name, nameEn, description, prices }) => ({
          id,
          name,
          nameEn,
          description,
          prices,
        })),
        regionPrices,
        updatedBy,
      },
      { upsert: true, new: true }
    ),
    ResortConfig.findOneAndUpdate(
      { key: 'default' },
      { resorts: sanitizedResorts, updatedBy },
      { upsert: true, new: true }
    ),
  ]);

  invalidateCatalogCache();
  return getPricingTable();
}

module.exports = {
  loadCatalog,
  getPricingTable,
  getRegionIds,
  getResortIds,
  getResort,
  getResortMap,
  getResortsConfig,
  getRegion,
  getRegionPricesMap,
  getPricingRegion,
  calculatePrice,
  applyResortToBooking,
  saveCatalog,
  invalidateCatalogCache,
  slugify,
};
