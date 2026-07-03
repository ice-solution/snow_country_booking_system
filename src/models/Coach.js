const mongoose = require('mongoose');

const SPECIALTIES = ['ski', 'snowboard'];
const LANGUAGES = ['zh', 'en', 'ja', 'any'];
const HEAT_LEVELS = ['high', 'medium', 'low'];

const coachSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    specialties: {
      type: [{ type: String, enum: SPECIALTIES }],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: '至少需要一項專長',
      },
    },
    languages: {
      type: [{ type: String, enum: LANGUAGES.filter((l) => l !== 'any') }],
      default: ['zh'],
    },
    isMainland: { type: Boolean, default: false },
    heatLevel: { type: String, enum: HEAT_LEVELS, default: 'medium' },
    skillLevel: { type: Number, min: 1, max: 5, default: 3 },
    maxDailyLessons: { type: Number, default: 2, min: 1 },
    isHeadCoach: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    leaveRequests: [
      {
        date: { type: Date, required: true },
        period: { type: String, enum: ['full', 'half_am', 'half_pm'], default: 'full' },
        reason: { type: String, trim: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        requestedAt: { type: Date, default: Date.now },
        reviewedAt: { type: Date },
        reviewedBy: { type: String, trim: true },
      },
    ],
    weeklyAvailability: [
      {
        dayOfWeek: { type: Number, min: 0, max: 6, required: true },
        available: { type: Boolean, default: true },
      },
    ],
    blockedDates: [
      {
        date: { type: Date, required: true },
        period: { type: String, enum: ['full', 'half_am', 'half_pm'], default: 'full' },
        reason: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
);

coachSchema.index({ active: 1, name: 1 });

module.exports = mongoose.model('Coach', coachSchema);
module.exports.SPECIALTIES = SPECIALTIES;
module.exports.LANGUAGES = LANGUAGES;
module.exports.HEAT_LEVELS = HEAT_LEVELS;
