const { body, param } = require('express-validator');
const Instructor = require('../models/Instructor');

const instructorValidators = {
  create: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('specialties')
      .isArray({ min: 1 })
      .withMessage('At least one specialty is required'),
    body('specialties.*').isIn(Instructor.SPECIALTIES),
    body('languages').optional().isArray(),
    body('languages.*').optional().isIn(Instructor.LANGUAGES.filter((l) => l !== 'any')),
    body('heatLevel').optional().isIn(Instructor.HEAT_LEVELS),
    body('skillLevel').optional().isInt({ min: 1, max: 5 }),
    body('maxDailyLessons').optional().isInt({ min: 1 }),
    body('isMainland').optional().isBoolean(),
    body('isHeadInstructor').optional().isBoolean(),
    body('isHeadCoach').optional().isBoolean(),
    body('active').optional().isBoolean(),
    body('pin').optional().isLength({ min: 4, max: 32 }),
    body('phone').optional().trim(),
    body('email').optional().trim().isEmail(),
  ],
  update: [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('specialties').optional().isArray({ min: 1 }),
    body('specialties.*').optional().isIn(Instructor.SPECIALTIES),
    body('heatLevel').optional().isIn(Instructor.HEAT_LEVELS),
    body('skillLevel').optional().isInt({ min: 1, max: 5 }),
    body('isHeadInstructor').optional().isBoolean(),
    body('isHeadCoach').optional().isBoolean(),
    body('active').optional().isBoolean(),
    body('pin').optional().isLength({ min: 4, max: 32 }),
  ],
  blockDate: [
    param('id').isMongoId(),
    body('date').isISO8601().withMessage('Please provide a valid date'),
    body('reason').optional().trim(),
    body('period').optional().isIn(['full', 'half_am', 'half_pm']),
  ],
  unblockDate: [
    param('id').isMongoId(),
    body('date').isISO8601().withMessage('Please provide a valid date'),
  ],
};

module.exports = instructorValidators;
