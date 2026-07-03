require('dotenv').config();
const mongoose = require('mongoose');
const Coach = require('../src/models/Coach');

const SAMPLE_COACHES = [
  {
    name: '陳教練',
    phone: '9123 4567',
    email: 'coach.chen@example.com',
    specialties: ['ski', 'snowboard'],
    languages: ['zh', 'en'],
    isMainland: true,
    heatLevel: 'high',
    skillLevel: 5,
    maxDailyLessons: 2,
  },
  {
    name: 'Yuki',
    phone: '9234 5678',
    email: 'yuki@example.com',
    specialties: ['snowboard'],
    languages: ['ja', 'en'],
    isMainland: false,
    heatLevel: 'medium',
    skillLevel: 4,
    maxDailyLessons: 2,
  },
  {
    name: 'David',
    phone: '9345 6789',
    email: 'david@example.com',
    specialties: ['ski'],
    languages: ['en'],
    isMainland: false,
    heatLevel: 'high',
    skillLevel: 4,
    maxDailyLessons: 3,
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/snow_country_booking';
  await mongoose.connect(uri);

  const count = await Coach.countDocuments();
  if (count > 0) {
    console.log(`已有 ${count} 位教練，跳過 seed`);
    process.exit(0);
  }

  await Coach.insertMany(SAMPLE_COACHES);
  console.log(`已建立 ${SAMPLE_COACHES.length} 位示範教練`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
