const Instructor = require('../models/Instructor');
const alertService = require('../services/alertService');
const { normalizePeriod } = require('../utils/leavePeriods');

async function listCoaches(req, res, next) {
  try {
    const { active } = req.query;
    const filter = {};
    if (active !== undefined) filter.active = active === 'true';

    const coaches = await Instructor.find(filter).sort({ name: 1 });
    res.json({ success: true, data: coaches });
  } catch (err) {
    next(err);
  }
}

async function getCoach(req, res, next) {
  try {
    const coach = await Instructor.findById(req.params.id);
    if (!coach) {
      return res.status(404).json({ success: false, message: 'Coach not found' });
    }
    res.json({ success: true, data: coach });
  } catch (err) {
    next(err);
  }
}

async function createCoach(req, res, next) {
  try {
    const coach = await Instructor.create(req.body);
    res.status(201).json({ success: true, data: coach });
  } catch (err) {
    next(err);
  }
}

async function updateCoach(req, res, next) {
  try {
    const coach = await Instructor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!coach) {
      return res.status(404).json({ success: false, message: 'Coach not found' });
    }
    res.json({ success: true, data: coach });
  } catch (err) {
    next(err);
  }
}

async function deleteCoach(req, res, next) {
  try {
    const coach = await Instructor.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!coach) {
      return res.status(404).json({ success: false, message: 'Coach not found' });
    }
    res.json({ success: true, data: coach, message: 'Coach deactivated' });
  } catch (err) {
    next(err);
  }
}

async function blockDate(req, res, next) {
  try {
    const { date, reason, period } = req.body;
    const coach = await Instructor.findById(req.params.id);
    if (!coach) {
      return res.status(404).json({ success: false, message: 'Coach not found' });
    }

    coach.blockedDates.push({
      date: new Date(date),
      reason,
      period: normalizePeriod(period),
    });
    await coach.save();

    const affectedBookingIds = await alertService.markBookingsNeedsAttentionForCoachDate(
      coach._id,
      date,
      reason
    );

    res.json({
      success: true,
      data: coach,
      affectedBookings: affectedBookingIds.length,
      message:
        affectedBookingIds.length > 0
          ? `Date blocked; ${affectedBookingIds.length} related booking(s) flagged for attention`
          : 'Date blocked',
    });
  } catch (err) {
    next(err);
  }
}

async function unblockDate(req, res, next) {
  try {
    const { date } = req.body;
    const coach = await Instructor.findById(req.params.id);
    if (!coach) {
      return res.status(404).json({ success: false, message: 'Coach not found' });
    }

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    coach.blockedDates = coach.blockedDates.filter((block) => {
      const blockDate = new Date(block.date);
      blockDate.setHours(0, 0, 0, 0);
      return blockDate.getTime() !== target.getTime();
    });

    await coach.save();
    res.json({ success: true, data: coach, message: 'Date unblocked' });
  } catch (err) {
    next(err);
  }
}

async function listPendingLeaveRequests(req, res, next) {
  try {
    const coaches = await Instructor.find({
      leaveRequests: { $elemMatch: { status: 'pending' } },
    }).select('name leaveRequests');

    const pending = [];
    for (const coach of coaches) {
      for (const lr of coach.leaveRequests) {
        if (lr.status === 'pending') {
          pending.push({
            coachId: coach._id,
            coachName: coach.name,
            requestId: lr._id,
            date: lr.date,
            period: lr.period || 'full',
            reason: lr.reason,
            requestedAt: lr.requestedAt,
          });
        }
      }
    }

    res.json({ success: true, data: pending });
  } catch (err) {
    next(err);
  }
}

async function reviewLeaveRequest(req, res, next) {
  try {
    const { id, requestId } = req.params;
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be approve or reject' });
    }

    const coach = await Instructor.findById(id);
    if (!coach) {
      return res.status(404).json({ success: false, message: 'Coach not found' });
    }

    const leaveReq = coach.leaveRequests.id(requestId);
    if (!leaveReq || leaveReq.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    leaveReq.status = action === 'approve' ? 'approved' : 'rejected';
    leaveReq.reviewedAt = new Date();
    leaveReq.reviewedBy = 'admin';

    let affectedBookings = 0;
    if (action === 'approve') {
      const dateStr = leaveReq.date.toISOString().split('T')[0];
      const exists = coach.blockedDates.some((b) => {
        const d = new Date(b.date);
        d.setHours(0, 0, 0, 0);
        const t = new Date(leaveReq.date);
        t.setHours(0, 0, 0, 0);
        return d.getTime() === t.getTime();
      });
      if (!exists) {
        coach.blockedDates.push({
          date: leaveReq.date,
          reason: leaveReq.reason || 'Leave request',
          period: normalizePeriod(leaveReq.period),
        });
      }
      const affected = await alertService.markBookingsNeedsAttentionForCoachDate(
        coach._id,
        dateStr,
        leaveReq.reason
      );
      affectedBookings = affected.length;
    }

    await coach.save();
    res.json({
      success: true,
      data: coach,
      affectedBookings,
      message: action === 'approve' ? 'Leave approved' : 'Leave rejected',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCoaches,
  getCoach,
  createCoach,
  updateCoach,
  deleteCoach,
  blockDate,
  unblockDate,
  listPendingLeaveRequests,
  reviewLeaveRequest,
};
