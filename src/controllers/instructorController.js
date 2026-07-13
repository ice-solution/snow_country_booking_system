const Instructor = require('../models/Instructor');
const alertService = require('../services/alertService');
const { normalizePeriod } = require('../utils/leavePeriods');

function applyPinUpdate(instructor, body) {
  const data = { ...body };
  if (data.pin) {
    instructor.setPin(data.pin);
    delete data.pin;
  }
  if (data.pin === '') {
    instructor.pinHash = undefined;
    delete data.pin;
  }
  return data;
}

async function listInstructors(req, res, next) {
  try {
    const { active } = req.query;
    const filter = {};
    if (active !== undefined) filter.active = active === 'true';

    const instructors = await Instructor.find(filter).sort({ name: 1 });
    res.json({ success: true, data: instructors });
  } catch (err) {
    next(err);
  }
}

async function getInstructor(req, res, next) {
  try {
    const instructor = await Instructor.findById(req.params.id);
    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }
    res.json({ success: true, data: instructor });
  } catch (err) {
    next(err);
  }
}

async function createInstructor(req, res, next) {
  try {
    const instructor = new Instructor(req.body);
    if (req.body.pin) instructor.setPin(req.body.pin);
    await instructor.save();
    res.status(201).json({ success: true, data: instructor });
  } catch (err) {
    next(err);
  }
}

async function updateInstructor(req, res, next) {
  try {
    const instructor = await Instructor.findById(req.params.id).select('+pinHash');
    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }
    const data = applyPinUpdate(instructor, req.body);
    Object.assign(instructor, data);
    await instructor.save();
    res.json({ success: true, data: instructor });
  } catch (err) {
    next(err);
  }
}

async function deleteInstructor(req, res, next) {
  try {
    const instructor = await Instructor.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }
    res.json({ success: true, data: instructor, message: 'Instructor deactivated' });
  } catch (err) {
    next(err);
  }
}

async function blockDate(req, res, next) {
  try {
    const { date, reason, period } = req.body;
    const instructor = await Instructor.findById(req.params.id);
    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    instructor.blockedDates.push({
      date: new Date(date),
      reason,
      period: normalizePeriod(period),
    });
    await instructor.save();

    const affectedBookingIds = await alertService.markBookingsNeedsAttentionForInstructorDate(
      instructor._id,
      date,
      reason
    );

    res.json({
      success: true,
      data: instructor,
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
    const instructor = await Instructor.findById(req.params.id);
    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    instructor.blockedDates = instructor.blockedDates.filter((block) => {
      const blockDate = new Date(block.date);
      blockDate.setHours(0, 0, 0, 0);
      return blockDate.getTime() !== target.getTime();
    });

    await instructor.save();
    res.json({ success: true, data: instructor, message: 'Date unblocked' });
  } catch (err) {
    next(err);
  }
}

async function listPendingLeaveRequests(req, res, next) {
  try {
    const instructors = await Instructor.find({
      leaveRequests: { $elemMatch: { status: 'pending' } },
    }).select('name leaveRequests');

    const pending = [];
    for (const instructor of instructors) {
      for (const lr of instructor.leaveRequests) {
        if (lr.status === 'pending') {
          pending.push({
            instructorId: instructor._id,
            instructorName: instructor.name,
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

    const instructor = await Instructor.findById(id);
    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    const leaveReq = instructor.leaveRequests.id(requestId);
    if (!leaveReq || leaveReq.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    leaveReq.status = action === 'approve' ? 'approved' : 'rejected';
    leaveReq.reviewedAt = new Date();
    leaveReq.reviewedBy = 'admin';

    let affectedBookings = 0;
    if (action === 'approve') {
      const dateStr = leaveReq.date.toISOString().split('T')[0];
      const exists = instructor.blockedDates.some((b) => {
        const d = new Date(b.date);
        d.setHours(0, 0, 0, 0);
        const t = new Date(leaveReq.date);
        t.setHours(0, 0, 0, 0);
        return d.getTime() === t.getTime();
      });
      if (!exists) {
        instructor.blockedDates.push({
          date: leaveReq.date,
          reason: leaveReq.reason || 'Leave request',
          period: normalizePeriod(leaveReq.period),
        });
      }
      const affected = await alertService.markBookingsNeedsAttentionForInstructorDate(
        instructor._id,
        dateStr,
        leaveReq.reason
      );
      affectedBookings = affected.length;
    }

    await instructor.save();
    res.json({
      success: true,
      data: instructor,
      affectedBookings,
      message: action === 'approve' ? 'Leave approved' : 'Leave rejected',
    });
  } catch (err) {
    next(err);
  }
}

async function loginInstructor(req, res, next) {
  try {
    const { login, pin } = req.body;
    if (!login || !pin) {
      return res.status(400).json({ success: false, message: 'login and pin are required' });
    }

    const normalized = String(login).trim().toLowerCase();
    const instructor = await Instructor.findOne({
      active: true,
      $or: [{ email: normalized }, { phone: String(login).trim() }],
    }).select('+pinHash');

    if (!instructor || !instructor.verifyPin(pin)) {
      return res.status(401).json({ success: false, message: 'Invalid login or PIN' });
    }

    const token = instructor.issueLoginToken();
    await instructor.save();

    res.json({
      success: true,
      data: {
        token,
        instructor: {
          _id: instructor._id,
          name: instructor.name,
          email: instructor.email,
          phone: instructor.phone,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function logoutInstructor(req, res, next) {
  try {
    req.instructor.loginToken = undefined;
    req.instructor.loginTokenExpires = undefined;
    await req.instructor.save();
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    res.json({ success: true, data: req.instructor });
  } catch (err) {
    next(err);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const instructor = await Instructor.findById(req.instructorId);
    if (!instructor || !instructor.active) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    const { name, phone, email, languages } = req.body;
    if (name !== undefined) instructor.name = String(name).trim();
    if (phone !== undefined) instructor.phone = String(phone).trim();
    if (email !== undefined) instructor.email = String(email).trim().toLowerCase();
    if (languages !== undefined) {
      const valid = languages.filter((l) => Instructor.LANGUAGES.includes(l) && l !== 'any');
      if (!valid.length) {
        return res.status(400).json({ success: false, message: 'At least one language is required' });
      }
      instructor.languages = valid;
    }

    await instructor.save();
    res.json({ success: true, data: instructor, message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
}

async function changeMyPin(req, res, next) {
  try {
    const instructor = await Instructor.findById(req.instructorId).select('+pinHash');
    if (!instructor || !instructor.active) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin) {
      return res.status(400).json({ success: false, message: 'currentPin and newPin are required' });
    }
    if (!instructor.verifyPin(currentPin)) {
      return res.status(401).json({ success: false, message: 'Current PIN is incorrect' });
    }

    instructor.setPin(newPin);
    await instructor.save();
    res.json({ success: true, message: 'PIN updated successfully' });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
}

module.exports = {
  listInstructors,
  getInstructor,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  blockDate,
  unblockDate,
  listPendingLeaveRequests,
  reviewLeaveRequest,
  loginInstructor,
  logoutInstructor,
  getMe,
  updateMyProfile,
  changeMyPin,
};
