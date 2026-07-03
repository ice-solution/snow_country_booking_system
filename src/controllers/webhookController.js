const { constructWebhookEvent } = require('../services/stripeService');
const websiteBookingService = require('../services/websiteBookingService');

async function handleStripeWebhook(req, res) {
  const signature = req.headers['stripe-signature'];

  try {
    const event = await constructWebhookEvent(req.body, signature);

    if (event.type === 'checkout.session.completed') {
      await websiteBookingService.handleCheckoutCompleted(event.data.object);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    res.status(400).json({ success: false, message: `Webhook Error: ${err.message}` });
  }
}

module.exports = { handleStripeWebhook };
