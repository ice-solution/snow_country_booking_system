const Stripe = require('stripe');

let stripeClient = null;

function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

function isStripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getBaseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

const { getResort, getPricingRegion } = require('../config/resorts');

function toStripeAmount(amount, currency) {
  const zeroDecimal = ['jpy', 'krw', 'vnd'];
  if (zeroDecimal.includes((currency || '').toLowerCase())) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}

async function createCheckoutSession(booking, req) {
  const stripe = getStripe();
  if (!stripe) {
    const error = new Error('Stripe 尚未設定，請聯絡管理員');
    error.status = 503;
    throw error;
  }

  const baseUrl = getBaseUrl(req);
  const lessonTypeLabel = booking.lessonType === 'ski' ? 'Ski 滑雪' : 'Snowboard 單板';
  const resort = getResort(booking.resortLocation);
  const regionLabel = resort?.name || getPricingRegion(booking.region)?.name || booking.region;
  const currency = booking.currency || 'jpy';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: booking.email || undefined,
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: toStripeAmount(booking.totalAmount, currency),
          product_data: {
            name: `Snow Country 滑雪課程 - ${lessonTypeLabel}`,
            description: `${regionLabel} · ${booking.durationHours} 小時 · ${booking.totalGuests} 人 · ${new Date(booking.lessonDate).toLocaleDateString('zh-HK')}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      bookingId: booking._id.toString(),
      publicRef: booking.publicRef,
    },
    success_url: `${baseUrl}/confirmation.html?id=${booking._id}&ref=${booking.publicRef}&payment=success`,
    cancel_url: `${baseUrl}/book.html?cancelled=1`,
  });

  return session;
}

async function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    const error = new Error('Stripe webhook 尚未設定');
    error.status = 503;
    throw error;
  }

  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

module.exports = {
  getStripe,
  isStripeEnabled,
  createCheckoutSession,
  constructWebhookEvent,
};
