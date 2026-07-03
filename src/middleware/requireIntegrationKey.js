function requireIntegrationKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expected = process.env.INTEGRATION_API_KEY || process.env.ADMIN_API_KEY;

  if (!expected || expected === 'change-me-to-a-secure-key') {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        success: false,
        message: '請設定 INTEGRATION_API_KEY 環境變數',
      });
    }
    return next();
  }

  if (apiKey !== expected) {
    return res.status(401).json({
      success: false,
      message: '未授權：請提供有效的 X-API-Key',
    });
  }

  next();
}

module.exports = requireIntegrationKey;
