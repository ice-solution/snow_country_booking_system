const mongoose = require('mongoose');
const { PRICING_REGIONS } = require('../config/resorts');

function defaultRegionPrices() {
  return Object.fromEntries(
    Object.entries(PRICING_REGIONS).map(([id, region]) => [id, { ...region.prices }])
  );
}

const pricingConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    regions: {
      type: [
        {
          id: String,
          name: String,
          nameEn: String,
          description: String,
          prices: mongoose.Schema.Types.Mixed,
        },
      ],
      default: undefined,
    },
    regionPrices: {
      type: mongoose.Schema.Types.Mixed,
      default: defaultRegionPrices,
    },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);
module.exports.defaultRegionPrices = defaultRegionPrices;
