const mongoose = require('mongoose');
const { RESORTS } = require('../config/resorts');

function defaultResorts() {
  return RESORTS.map((r) => ({
    id: r.id,
    name: r.name,
    nameEn: r.nameEn,
    region: r.region,
    color: r.color,
    active: r.active !== false,
  }));
}

const resortConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    resorts: {
      type: [
        {
          id: String,
          name: String,
          nameEn: String,
          region: String,
          color: String,
          active: Boolean,
        },
      ],
      default: defaultResorts,
    },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ResortConfig', resortConfigSchema);
module.exports.defaultResorts = defaultResorts;
