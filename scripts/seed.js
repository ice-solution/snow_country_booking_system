require('dotenv').config();
const mongoose = require('mongoose');
const Instructor = require('../src/models/Instructor');

const SAMPLE_INSTRUCTORS = [
  {
    name: '陳教練',
    phone: '91234567',
    email: 'coach.chen@example.com',
    specialties: ['ski', 'snowboard'],
    languages: ['zh', 'en'],
    isMainland: true,
    heatLevel: 'high',
    skillLevel: 5,
    maxDailyLessons: 2,
    pin: '1234',
  },
  {
    name: 'Yuki',
    phone: '92345678',
    email: 'yuki@example.com',
    specialties: ['snowboard'],
    languages: ['ja', 'en'],
    isMainland: false,
    heatLevel: 'medium',
    skillLevel: 4,
    maxDailyLessons: 2,
    pin: '1234',
  },
  {
    name: 'David',
    phone: '93456789',
    email: 'david@example.com',
    specialties: ['ski'],
    languages: ['en'],
    isMainland: false,
    heatLevel: 'high',
    skillLevel: 4,
    maxDailyLessons: 3,
    pin: '1234',
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/snow_country_booking';
  await mongoose.connect(uri);

  const count = await Instructor.countDocuments();
  if (count > 0) {
    const withoutPin = await Instructor.find({ pinHash: { $exists: false } }).select('+pinHash');
    for (const instructor of withoutPin) {
      instructor.setPin('1234');
      await instructor.save();
      console.log(`已為 ${instructor.name} 設定預設 PIN: 1234`);
    }
    console.log(`已有 ${count} 位導師，跳過新增`);
    process.exit(0);
  }

  for (const data of SAMPLE_INSTRUCTORS) {
    const instructor = new Instructor(data);
    instructor.setPin(data.pin);
    await instructor.save();
  }
  console.log(`已建立 ${SAMPLE_INSTRUCTORS.length} 位示範導師（預設 PIN: 1234）`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
