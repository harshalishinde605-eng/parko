const { prisma } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { asyncHandler, ok, fail } = require('../utils/apiResponse');
const { audit } = require('../utils/audit');

const register = asyncHandler(async (req, res) => {
  const { email, password, fullName, role } = req.body;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail(res, 'Email already registered', 409);
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash, fullName, role } });
  if (role === 'DOCTOR') await prisma.doctor.create({ data: { userId: user.id } });
  if (role === 'CAREGIVER') await prisma.caregiver.create({ data: { userId: user.id } });
  await audit(user.id, 'register', 'users', user.id, req.ip);
  return ok(res, { id: user.id, email: user.email, role: user.role, fullName: user.fullName }, 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt || !user.isActive) return fail(res, 'Invalid credentials', 401);
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return fail(res, 'Invalid credentials', 401);
  const payload = { sub: user.id, role: user.role };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);
  await audit(user.id, 'login', 'users', user.id, req.ip);
  return ok(res, { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName } });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return fail(res, 'Missing refresh token', 401);
  try {
    const decoded = verifyRefresh(refreshToken);
    const accessToken = signAccess({ sub: decoded.sub, role: decoded.role });
    return ok(res, { accessToken });
  } catch { return fail(res, 'Invalid refresh token', 401); }
});

const me = asyncHandler(async (req, res) => ok(res, req.user));
const logout = asyncHandler(async (req, res) => { await audit(req.user.id, 'logout', 'users', req.user.id, req.ip); return ok(res, { message: 'Logged out' }); });

module.exports = { register, login, refresh, me, logout };
