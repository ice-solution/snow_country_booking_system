const express = require('express');
const coachesRouter = require('./coaches');
const bookingsRouter = require('./bookings');
const websiteRouter = require('./website');
const alertsRouter = require('./alerts');
const scheduleRouter = require('./schedule');
const ganttRouter = require('./gantt');
const integrationsRouter = require('./integrations');
const coachViewRouter = require('./coachView');
const pricingRouter = require('./pricing');
const capacityRouter = require('./capacity');
const resortsRouter = require('./resorts');
const Coach = require('../models/Coach');
const Booking = require('../models/Booking');
const catalogService = require('../services/catalogService');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'OK', timestamp: new Date().toISOString() });
});

router.get('/meta', async (req, res, next) => {
  try {
    const pricing = await catalogService.getPricingTable();
    const resortConfig = await catalogService.getResortsConfig();
    const regionIds = await catalogService.getRegionIds();
    const resortIds = await catalogService.getResortIds(true);
    res.json({
      success: true,
      data: {
        specialties: Coach.SPECIALTIES,
        languages: Coach.LANGUAGES,
        heatLevels: Coach.HEAT_LEVELS,
        bookingSources: Booking.BOOKING_SOURCES,
        bookingStatuses: Booking.BOOKING_STATUSES,
        lessonTypes: Booking.LESSON_TYPES,
        durationHours: Booking.DURATION_HOURS,
        languagePrefs: Booking.LANGUAGE_PREFS,
        paymentMethods: Booking.PAYMENT_METHODS,
        paymentStatuses: Booking.PAYMENT_STATUSES,
        regions: regionIds,
        resorts: resortIds,
        resortConfig,
        pricing,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.use('/coaches', coachesRouter);
router.use('/bookings', bookingsRouter);
router.use('/website', websiteRouter);
router.use('/alerts', alertsRouter);
router.use('/schedule', scheduleRouter);
router.use('/gantt', ganttRouter);
router.use('/integrations', integrationsRouter);
router.use('/pricing', pricingRouter);
router.use('/capacity', capacityRouter);
router.use('/resorts', resortsRouter);
router.use('/coach-view', coachViewRouter);

module.exports = router;
