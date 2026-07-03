require('dotenv').config();
const mongoose = require('mongoose');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/snow_country_booking';

  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = { connectDatabase };
