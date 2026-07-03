const mongoose = require('mongoose');

const BOOKING_SOURCES = ['website', 'klook', 'whatsapp', 'line', 'webchat', 'admin'];
const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'assigned',
  'completed',
  'cancelled',
  'needs_attention',
];
const LESSON_TYPES = ['ski', 'snowboard'];
const DURATION_HOURS = [3, 4, 5, 6];
const LANGUAGE_PREFS = ['zh', 'en', 'any'];
const PAYMENT_METHODS = ['stripe', 'on_site'];
const PAYMENT_STATUSES = ['unpaid', 'paid_online', 'pay_on_site', 'paid_on_site'];

const assignedCoachSchema = new mongoose.Schema(
  {
    coach: { type: mongoose.Schema.Types.ObjectId, ref: 'Coach', required: true },
    assignmentScore: { type: Number },
    assignedBy: { type: String, default: 'manual' },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    source: { type: String, enum: BOOKING_SOURCES, default: 'website' },
    status: { type: String, enum: BOOKING_STATUSES, default: 'pending' },

    lessonDate: { type: Date, required: true },
    durationHours: { type: Number, enum: DURATION_HOURS, required: true },
    region: { type: String, required: true, trim: true },
    resortLocation: { type: String, required: true, trim: true },
    lessonType: { type: String, enum: LESSON_TYPES, required: true },

    totalGuests: { type: Number, required: true, min: 1 },
    childrenUnder6: { type: Number, default: 0, min: 0 },
    coachesRequired: { type: Number, required: true, min: 1, max: 2 },

    guestName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    instagram: { type: String, trim: true },
    facebook: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    line: { type: String, trim: true },
    wechat: { type: String, trim: true },
    languagePref: { type: String, enum: LANGUAGE_PREFS, default: 'any' },
    specialRequests: { type: String, trim: true },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'on_site' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pay_on_site' },
    stripeSessionId: { type: String },

    totalAmount: { type: Number, min: 0 },
    currency: { type: String, default: 'hkd' },
    publicRef: { type: String, index: true },

    klookOrderId: { type: String, trim: true, index: true },

    lessonStartTime: { type: String, trim: true },

    assignedCoaches: [assignedCoachSchema],

    confirmedAt: { type: Date },
    confirmedBy: { type: String },
    adminNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

bookingSchema.index({ status: 1, lessonDate: 1 });
bookingSchema.index({ lessonDate: 1 });

bookingSchema.pre('validate', async function syncRegionFromResort() {
  const catalogService = require('../services/catalogService');
  if (this.resortLocation) {
    const resort = await catalogService.getResort(this.resortLocation);
    if (resort) this.region = resort.region;
  }
});

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.BOOKING_SOURCES = BOOKING_SOURCES;
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
module.exports.LESSON_TYPES = LESSON_TYPES;
module.exports.DURATION_HOURS = DURATION_HOURS;
module.exports.LANGUAGE_PREFS = LANGUAGE_PREFS;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
