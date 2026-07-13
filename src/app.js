const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const webhookRoutes = require('./routes/webhooks');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(morgan('dev'));

  // Stripe webhook 需要 raw body，必須在 json parser 之前
  app.use('/api/v1/webhooks', webhookRoutes);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/v1', apiRoutes);

  app.use('/shared', express.static(path.join(__dirname, '../shared')));
  app.use('/admin', express.static(path.join(__dirname, '../admin')));
  app.use('/instructor', express.static(path.join(__dirname, '../instructor')));
  app.use('/coach', express.static(path.join(__dirname, '../instructor')));
  app.use(express.static(path.join(__dirname, '../public')));

  app.get('/api', (req, res) => {
    res.json({
      success: true,
      message: 'Snow Country Booking System API',
      docs: {
        health: '/api/v1/health',
        meta: '/api/v1/meta',
        website: '/book.html',
        admin: '/admin',
      },
    });
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, message: '找不到路由' });
  });

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
