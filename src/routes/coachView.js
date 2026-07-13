const express = require('express');
const Instructor = require('../models/Instructor');
const ganttController = require('../controllers/ganttController');
const { body } = require('express-validator');
const { normalizePeriod } = require('../utils/leavePeriods');
const validate = require('../middleware/validate');
const { getGuestSummaryForCoach } = require('../services/guestSummaryService');

const router = express.Router();

router.get('/coaches', async (req, res, next) => {
  try {
    const coaches = await Instructor.find({ active: true }).select('name specialties isHeadCoach').sort({ name: 1 });
    res.json({ success: true, data: coaches });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:coachId/leave-requests',
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Valid date required'),
  body('reason').optional().trim(),
  body('period').optional().isIn(['full', 'half_am', 'half_pm']),
  validate,
  async (req, res, next) => {
    try {
      const coach = await Instructor.findById(req.params.coachId);
      if (!coach || !coach.active) {
        return res.status(404).json({ success: false, message: 'Coach not found' });
      }

      const [year, month, day] = req.body.date.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);

      const duplicate = coach.leaveRequests.some((lr) => {
        const d = new Date(lr.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === date.getTime() && lr.status === 'pending';
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Leave request already pending for this date' });
      }

      coach.leaveRequests.push({
        date,
        reason: req.body.reason || '',
        period: normalizePeriod(req.body.period),
        status: 'pending',
      });
      await coach.save();

      res.status(201).json({
        success: true,
        message: 'Leave request submitted — pending admin approval',
        data: coach.leaveRequests[coach.leaveRequests.length - 1],
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/bookings/:bookingId', async (req, res, next) => {
  try {
    const data = await getGuestSummaryForCoach(req.params.bookingId, req.query.coachId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/:coachId/gantt', ganttController.getCoachGanttView);
router.get('/:coachId/schedule', ganttController.getCoachSchedule);

module.exports = router;
