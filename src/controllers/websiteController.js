const pricingConfigService = require('../services/pricingConfigService');
const websiteBookingService = require('../services/websiteBookingService');
const { isStripeEnabled } = require('../services/stripeService');

async function getPricing(req, res, next) {
  try {
    const table = await pricingConfigService.getPricingTable();
    res.json({
      success: true,
      data: {
        ...table,
        stripeEnabled: isStripeEnabled(),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getQuote(req, res, next) {
  try {
    const data = await websiteBookingService.getQuote(req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function submitBooking(req, res, next) {
  try {
    const data = await websiteBookingService.submitWebsiteBooking(req.body, req);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getPublicBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { ref } = req.query;
    if (!ref) {
      return res.status(400).json({ success: false, message: '缺少查詢參考碼' });
    }
    const data = await websiteBookingService.getPublicBooking(id, ref);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

const { getDailyCapacity } = require('../services/capacityService');

async function getAvailability(req, res, next) {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date is required' });
    }
    const capacity = await getDailyCapacity(date);
    res.json({ success: true, data: capacity });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPricing,
  getQuote,
  submitBooking,
  getPublicBooking,
  getAvailability,
};
