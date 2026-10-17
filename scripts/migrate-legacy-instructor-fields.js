require('dotenv').config();
const mongoose = require('mongoose');
const { migrateLegacyInstructorFields } = require('../src/migrations/legacyInstructorFields');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await migrateLegacyInstructorFields(mongoose.connection.db);
  const Booking = require('../src/models/Booking');
  const Instructor = require('../src/models/Instructor');
  console.log('instructors count', await Instructor.countDocuments());
  const b = await Booking.findOne().lean();
  console.log(
    'booking fields',
    b ? Object.keys(b).filter((k) => /instruct|assign/i.test(k)) : null
  );
  console.log('instructorsRequired', b?.instructorsRequired, 'assigned', b?.assignedInstructors?.length);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
