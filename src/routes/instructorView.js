const express = require('express');
const { body } = require('express-validator');
const instructorController = require('../controllers/instructorController');
const ganttController = require('../controllers/ganttController');
const validate = require('../middleware/validate');
const requireInstructorAuth = require('../middleware/requireInstructorAuth');
const { getGuestSummaryForInstructor } = require('../services/guestSummaryService');

const router = express.Router();

router.post(
  '/login',
  body('login').trim().notEmpty(),
  body('pin').trim().notEmpty(),
  validate,
  instructorController.loginInstructor
);

router.use(requireInstructorAuth);

router.post('/logout', instructorController.logoutInstructor);
router.get('/me', instructorController.getMe);
router.put(
  '/me',
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('email').optional({ values: 'falsy' }).trim().isEmail(),
  body('languages').optional().isArray({ min: 1 }),
  body('languages.*').optional().isIn(['zh', 'en', 'ja']),
  validate,
  instructorController.updateMyProfile
);
router.put(
  '/me/pin',
  body('currentPin').trim().notEmpty(),
  body('newPin').trim().isLength({ min: 4, max: 32 }),
  validate,
  instructorController.changeMyPin
);

router.post(
  '/leave-requests',
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Valid date required'),
  body('reason').optional().trim(),
  body('period').optional().isIn(['full', 'half_am', 'half_pm']),
  validate,
  async (req, res, next) => {
    try {
      const instructor = req.instructor;
      const [year, month, day] = req.body.date.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);

      const duplicate = instructor.leaveRequests.some((lr) => {
        const d = new Date(lr.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === date.getTime() && lr.status === 'pending';
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Leave request already pending for this date' });
      }

      instructor.leaveRequests.push({
        date,
        reason: req.body.reason || '',
        period: require('../utils/leavePeriods').normalizePeriod(req.body.period),
        status: 'pending',
      });
      await instructor.save();

      res.status(201).json({
        success: true,
        message: 'Leave request submitted — pending admin approval',
        data: instructor.leaveRequests[instructor.leaveRequests.length - 1],
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/bookings/:bookingId', async (req, res, next) => {
  try {
    const data = await getGuestSummaryForInstructor(req.params.bookingId, req.instructorId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/gantt', ganttController.getInstructorGanttView);
router.get('/schedule', ganttController.getInstructorScheduleView);
router.get('/day-overview', ganttController.getInstructorDayOverview);

module.exports = router;
