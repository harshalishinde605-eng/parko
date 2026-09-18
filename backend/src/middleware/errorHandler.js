const { logger } = require('../utils/logger');
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.path });
  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ success: false, error: message });
}
module.exports = { errorHandler };
