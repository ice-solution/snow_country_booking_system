const Instructor = require('../models/Instructor');

async function requireInstructorAuth(req, res, next) {
  const token = req.headers['x-instructor-token'];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: instructor login required' });
  }

  try {
    const instructor = await Instructor.findOne({
      loginToken: token,
      loginTokenExpires: { $gt: new Date() },
      active: true,
    }).select('+loginToken +loginTokenExpires +pinHash');

    if (!instructor) {
      return res.status(401).json({ success: false, message: 'Invalid or expired instructor session' });
    }

    req.instructor = instructor;
    req.instructorId = instructor._id.toString();
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireInstructorAuth;
