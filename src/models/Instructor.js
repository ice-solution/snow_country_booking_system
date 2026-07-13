const mongoose = require('mongoose');
const crypto = require('crypto');

const SPECIALTIES = ['ski', 'snowboard'];
const LANGUAGES = ['zh', 'en', 'ja', 'any'];
const HEAT_LEVELS = ['high', 'medium', 'low'];

const PIN_SALT = () => process.env.INSTRUCTOR_PIN_SALT || 'snow-country-instructor-pin';

function hashPin(pin) {
  return crypto.createHash('sha256').update(`${PIN_SALT()}:${String(pin)}`).digest('hex');
}

function generateLoginToken() {
  return crypto.randomBytes(32).toString('hex');
}

const instructorSchema = new mongoose.Schema(
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
    isHeadInstructor: { type: Boolean, default: false, alias: 'isHeadCoach' },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    pinHash: { type: String, select: false },
    loginToken: { type: String, select: false },
    loginTokenExpires: { type: Date, select: false },
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
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        if (ret.isHeadCoach !== undefined && ret.isHeadInstructor === undefined) {
          ret.isHeadInstructor = ret.isHeadCoach;
        }
        delete ret.isHeadCoach;
        delete ret.pinHash;
        delete ret.loginToken;
        delete ret.loginTokenExpires;
        return ret;
      },
    },
  }
);

instructorSchema.index({ active: 1, name: 1 });
instructorSchema.index({ loginToken: 1 });

instructorSchema.methods.setPin = function setPin(pin) {
  if (!pin || String(pin).length < 4) {
    const error = new Error('PIN must be at least 4 characters');
    error.status = 400;
    throw error;
  }
  this.pinHash = hashPin(pin);
};

instructorSchema.methods.verifyPin = function verifyPin(pin) {
  if (!this.pinHash) return false;
  return hashPin(pin) === this.pinHash;
};

instructorSchema.methods.issueLoginToken = function issueLoginToken() {
  const token = generateLoginToken();
  this.loginToken = token;
  this.loginTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return token;
};

const Instructor = mongoose.model('Instructor', instructorSchema, 'coaches');

module.exports = Instructor;
module.exports.SPECIALTIES = SPECIALTIES;
module.exports.LANGUAGES = LANGUAGES;
module.exports.HEAT_LEVELS = HEAT_LEVELS;
module.exports.hashPin = hashPin;
