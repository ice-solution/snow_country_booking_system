/**
 * 滑雪場設定（單一設定檔）
 *
 * 新增 / 修改滑雪場：編輯下方 RESORTS 陣列即可
 * - region：決定收費地區（同地區價格相同）
 * - color：Gantt chart 色塊顏色
 * - active：false 則不在預約表單顯示
 */
const CURRENCY = 'jpy';

/** 收費地區（套票價格 JPY，每組導師 1–4 人） */
const PRICING_REGIONS = {
  yuzawa: {
    id: 'yuzawa',
    name: '湯澤地區',
    description: 'GALA 湯澤、岩原、苗場周邊等',
    prices: { 3: 32000, 4: 46000, 5: 52000, 6: 62000 },
  },
  kagura_joetsu: {
    id: 'kagura_joetsu',
    name: '神樂・上越國際',
    description: 'Kagura、Joetsu Kokusai',
    prices: { 3: 43000, 4: 53000, 5: 63000, 6: 72000 },
  },
  naeba: {
    id: 'naeba',
    name: '苗場地區',
    description: '苗場滑雪場',
    prices: { 3: 44500, 4: 59000, 5: 74000, 6: 88500 },
  },
};

const REGION_IDS = Object.keys(PRICING_REGIONS);

/**
 * 滑雪場列表
 * id 必須唯一；region 對應 PRICING_REGIONS 的 key
 */
const RESORTS = [
  // ── 湯澤地區 ──
  { id: 'gala', name: 'GALA 湯澤', nameEn: 'GALA Yuzawa', region: 'yuzawa', color: '#67E8F9', active: true },
  { id: 'iwappara', name: '岩原滑雪場', nameEn: 'Iwappara', region: 'yuzawa', color: '#93C5FD', active: true },
  { id: 'nakazato', name: '湯澤中里', nameEn: 'Yuzawa Nakazato', region: 'yuzawa', color: '#86EFAC', active: true },
  { id: 'ishiuchi', name: '石打丸山', nameEn: 'Ishiuchi Maruyama', region: 'yuzawa', color: '#FDE047', active: true },
  { id: 'maiko', name: '舞子高原', nameEn: 'Maiko', region: 'yuzawa', color: '#FCA5A5', active: true },
  { id: 'naspa', name: 'Naspa 新大谷', nameEn: 'Naspa', region: 'yuzawa', color: '#C4B5FD', active: true },

  // ── 神樂・上越國際 ──
  { id: 'kagura', name: '神樂滑雪場', nameEn: 'Kagura', region: 'kagura_joetsu', color: '#F9A8D4', active: true },
  { id: 'joetsu', name: '上越國際滑雪場', nameEn: 'Joetsu Kokusai', region: 'kagura_joetsu', color: '#A5B4FC', active: true },

  // ── 苗場 ──
  { id: 'naeba', name: '苗場滑雪場', nameEn: 'Naeba', region: 'naeba', color: '#FDBA74', active: true },

  // ── 系統用（解析失敗時）──
  { id: 'other', name: '待確認', nameEn: 'TBC', region: 'yuzawa', color: '#D1D5DB', active: false },
];

const RESORT_ALIASES = {
  iwappara: 'iwappara',
  岩原: 'iwappara',
  'yuzawa nakazato': 'nakazato',
  nakazato: 'nakazato',
  湯澤中里: 'nakazato',
  'ishiuchi maruyama': 'ishiuchi',
  ishiuchi: 'ishiuchi',
  石打丸山: 'ishiuchi',
  maiko: 'maiko',
  舞子: 'maiko',
  gala: 'gala',
  'gala yuzawa': 'gala',
  naspa: 'naspa',
  kagura: 'kagura',
  神樂: 'kagura',
  'joetsu kokusai': 'joetsu',
  joetsu: 'joetsu',
  上越國際: 'joetsu',
  naeba: 'naeba',
  苗場: 'naeba',
};

const PRICING_NOTE =
  '價格為每組導師（最多 4 人）套票費用，含導師費及基本保險。不含纜車票、裝備租借及餐飲。最終以管理員確認為準。';

function getResortMap() {
  return Object.fromEntries(RESORTS.map((r) => [r.id, r]));
}

function getResort(resortId) {
  return getResortMap()[resortId] || null;
}

function getActiveResorts() {
  return RESORTS.filter((r) => r.active !== false);
}

function getResortIds(includeInactive = false) {
  return (includeInactive ? RESORTS : getActiveResorts()).map((r) => r.id);
}

function getPricingRegion(regionId) {
  return PRICING_REGIONS[regionId] || null;
}

function getRegionForResort(resortId) {
  const resort = getResort(resortId);
  return resort?.region || null;
}

function resolveResort(input) {
  if (!input) return getResort('other');
  const key = String(input).toLowerCase().trim();
  const aliasId = RESORT_ALIASES[key];
  if (aliasId) return getResort(aliasId);
  const byId = getResort(key);
  if (byId) return byId;
  const partial = RESORTS.find((r) => key.includes(r.id) || key.includes(r.nameEn?.toLowerCase()));
  return partial || getResort('other');
}

function applyResortToBooking(payload) {
  const resort = getResort(payload.resortLocation);
  if (!resort) {
    const error = new Error('無效的滑雪場');
    error.status = 400;
    throw error;
  }
  return {
    ...payload,
    resortLocation: resort.id,
    region: resort.region,
  };
}

function calculatePrice(resortIdOrRegion, durationHours, instructorsRequired) {
  const regionId = getResort(resortIdOrRegion)?.region || resortIdOrRegion;
  const region = getPricingRegion(regionId);
  if (!region) {
    const error = new Error('無效的收費地區');
    error.status = 400;
    throw error;
  }

  const packagePrice = region.prices[durationHours];
  if (!packagePrice) {
    const error = new Error('無效的課程時數');
    error.status = 400;
    throw error;
  }

  const resort = getResort(resortIdOrRegion);
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

function getResortsConfig() {
  return getActiveResorts().map((r) => ({
    id: r.id,
    name: r.name,
    nameEn: r.nameEn,
    region: r.region,
    regionName: PRICING_REGIONS[r.region]?.name,
    color: r.color,
  }));
}

function getPricingTable() {
  return {
    currency: CURRENCY,
    regions: REGION_IDS.map((id) => ({
      id,
      name: PRICING_REGIONS[id].name,
      description: PRICING_REGIONS[id].description,
      prices: PRICING_REGIONS[id].prices,
      resorts: getActiveResorts()
        .filter((r) => r.region === id)
        .map((r) => ({ id: r.id, name: r.name, nameEn: r.nameEn, color: r.color })),
    })),
    resorts: getResortsConfig(),
    note: PRICING_NOTE,
    includes: ['導師費', '基本保險'],
    excludes: ['纜車票', '裝備租借', '餐飲'],
    maxGuestsPerInstructor: 4,
  };
}

// 向後相容
const resolveLocation = resolveResort;
const getLocationsList = () =>
  RESORTS.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    region: r.region,
  }));

module.exports = {
  CURRENCY,
  PRICING_REGIONS,
  REGIONS: PRICING_REGIONS,
  REGION_IDS,
  RESORTS,
  RESORT_IDS: getResortIds(true),
  getResort,
  getActiveResorts,
  getResortIds,
  getPricingRegion,
  getRegionForResort,
  resolveResort,
  resolveLocation,
  applyResortToBooking,
  calculatePrice,
  getPricingTable,
  getResortsConfig,
  getLocationsList,
  PRICING_NOTE,
};
