const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ok = (res, data = null, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, error = 'Request failed', status = 400, details = undefined) =>
  res.status(status).json({ success: false, error, ...(details ? { details } : {}) });

module.exports = { asyncHandler, ok, fail };
