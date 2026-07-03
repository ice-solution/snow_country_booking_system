function requireAdminKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expected = process.env.ADMIN_API_KEY;

  if (!expected || expected === 'change-me-to-a-secure-key') {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        success: false,
        message: 'Please set ADMIN_API_KEY environment variable',
      });
    }
    return next();
  }

  if (apiKey !== expected) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: provide a valid X-API-Key',
    });
  }

  next();
}

module.exports = requireAdminKey;
