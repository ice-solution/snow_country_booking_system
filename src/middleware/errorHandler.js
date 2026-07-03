function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
