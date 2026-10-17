/**
 * One-time migration: rename legacy MongoDB collection/fields to instructor naming.
 * Legacy key strings below must match the old schema exactly.
 */
const LEGACY = {
  collection: 'coaches',
  requiredField: 'coachesRequired',
  assignedArray: 'assignedCoaches',
  assignedRef: 'coach',
  headFlag: 'isHeadCoach',
};

async function migrateLegacyInstructorFields(db) {
  const collections = await db.listCollections().toArray();
  const names = new Set(collections.map((c) => c.name));

  if (names.has(LEGACY.collection) && !names.has('instructors')) {
    await db.collection(LEGACY.collection).rename('instructors');
    console.log('Renamed legacy instructor collection → instructors');
  } else if (names.has(LEGACY.collection) && names.has('instructors')) {
    const leftover = await db.collection(LEGACY.collection).countDocuments();
    if (leftover === 0) {
      await db.collection(LEGACY.collection).drop();
      console.log('Dropped empty legacy instructor collection');
    } else {
      const docs = await db.collection(LEGACY.collection).find().toArray();
      for (const doc of docs) {
        await db
          .collection('instructors')
          .updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
      }
      console.log(`Merged ${docs.length} legacy instructor doc(s) into instructors`);
      await db.collection(LEGACY.collection).drop();
      console.log('Dropped legacy instructor collection');
    }
  }

  if (names.has('instructors') || names.has(LEGACY.collection)) {
    const instructorsCol = db.collection(names.has('instructors') ? 'instructors' : LEGACY.collection);
    const headResult = await instructorsCol.updateMany(
      { [LEGACY.headFlag]: { $exists: true }, isHeadInstructor: { $exists: false } },
      [{ $set: { isHeadInstructor: `$${LEGACY.headFlag}` } }, { $unset: LEGACY.headFlag }]
    );
    if (headResult.modifiedCount > 0) {
      console.log(
        `Migrated legacy head flag → isHeadInstructor on ${headResult.modifiedCount} instructor(s)`
      );
    }
  }

  const bookingsCol = db.collection('bookings');
  const legacyBookings = await bookingsCol
    .find({
      $or: [
        { [LEGACY.requiredField]: { $exists: true } },
        { [LEGACY.assignedArray]: { $exists: true } },
      ],
    })
    .toArray();

  let bookingMigrated = 0;
  for (const doc of legacyBookings) {
    const update = { $set: {}, $unset: {} };
    const legacyRequired = doc[LEGACY.requiredField];
    const legacyAssigned = doc[LEGACY.assignedArray];

    if (doc.instructorsRequired == null && legacyRequired != null) {
      update.$set.instructorsRequired = legacyRequired;
    }
    if (legacyRequired != null) update.$unset[LEGACY.requiredField] = '';

    if (Array.isArray(legacyAssigned)) {
      if (!Array.isArray(doc.assignedInstructors) || !doc.assignedInstructors.length) {
        update.$set.assignedInstructors = legacyAssigned.map((a) => ({
          instructor: a[LEGACY.assignedRef] || a.instructor,
          assignmentScore: a.assignmentScore,
          assignedBy: a.assignedBy,
          assignedAt: a.assignedAt,
        }));
      }
      update.$unset[LEGACY.assignedArray] = '';
    }

    if (!Object.keys(update.$set).length) delete update.$set;
    if (!Object.keys(update.$unset).length) delete update.$unset;
    if (!update.$set && !update.$unset) continue;

    await bookingsCol.updateOne({ _id: doc._id }, update);
    bookingMigrated += 1;
  }
  if (bookingMigrated > 0) {
    console.log(`Migrated ${bookingMigrated} booking(s) to instructor field names`);
  }
}

module.exports = { migrateLegacyInstructorFields };
