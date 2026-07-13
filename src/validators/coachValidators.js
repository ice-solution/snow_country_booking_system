const { body, param, query } = require('express-validator');
const Instructor = require('../models/Instructor');

const coachValidators = {
  create: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('specialties')
      .isArray({ min: 1 })
      .withMessage('At least one specialty is required'),
    body('specialties.*').isIn(Coach.SPECIALTIES),
    body('languages').optional().isArray(),
    body('languages.*').optional().isIn(Coach.LANGUAGES.filter((l) => l !== 'any')),
    body('heatLevel').optional().isIn(Coach.HEAT_LEVELS),
    body('skillLevel').optional().isInt({ min: 1, max: 5 }),
    body('maxDailyLessons').optional().isInt({ min: 1 }),
    body('isMainland').optional().isBoolean(),
    body('isHeadCoach').optional().isBoolean(),
    body('active').optional().isBoolean(),
  ],
  update: [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('specialties').optional().isArray({ min: 1 }),
    body('specialties.*').optional().isIn(Coach.SPECIALTIES),
    body('heatLevel').optional().isIn(Coach.HEAT_LEVELS),
    body('skillLevel').optional().isInt({ min: 1, max: 5 }),
    body('isHeadCoach').optional().isBoolean(),
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

module.exports = coachValidators;
