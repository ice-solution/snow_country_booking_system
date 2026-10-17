require('dotenv').config();
const mongoose = require('mongoose');
const createApp = require('./app');
const { connectDatabase } = require('./config/database');
const Booking = require('./models/Booking');
const { migrateLegacyInstructorFields } = require('./migrations/legacyInstructorFields');

const PORT = process.env.PORT || 3000;

async function migrateLessonDateRange() {
  const result = await Booking.updateMany(
    {
      $or: [{ lessonDateFrom: { $exists: false } }, { lessonDateTo: { $exists: false } }],
      lessonDate: { $exists: true },
    },
    [
      {
        $set: {
          lessonDateFrom: '$lessonDate',
          lessonDateTo: '$lessonDate',
        },
      },
    ]
  );
  if (result.modifiedCount > 0) {
    console.log(`Migrated ${result.modifiedCount} booking(s) to lesson date range fields`);
  }
}

async function start() {
  await connectDatabase();
  await migrateLessonDateRange();
  await migrateLegacyInstructorFields(mongoose.connection.db);
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`API: http://localhost:${PORT}/api/v1`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
