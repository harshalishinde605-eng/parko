const { verifyAccess } = require('../utils/jwt');
const { prisma } = require('../config/db');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, error: 'Missing token' });
  try {
    const decoded = verifyAccess(token);
    const user = await prisma.user.findFirst({ where: { id: decoded.sub, isActive: true, deletedAt: null } });
    if (!user) return res.status(401).json({ success: false, error: 'Invalid user' });
    req.user = { id: user.id, role: user.role, email: user.email, fullName: user.fullName };
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden: insufficient role' });
  }
  next();
};

// Ensures caregiver/doctor can access only their assigned patients. ADMIN bypasses.
async function patientAccess(req, res, next) {
  const patientId = req.params.id || req.params.patientId || req.body.patientId || req.body.patient_id;
  if (!patientId) return next();
  if (req.user.role === 'ADMIN') return next();
  const { prisma: db } = require('../config/db');
  let allowed = false;
  if (req.user.role === 'CAREGIVER') {
    const link = await db.patientCaregiver.findFirst({ where: { patientId, caregiverId: req.user.id } });
    allowed = !!link;
  } else if (req.user.role === 'DOCTOR') {
    const link = await db.patientDoctor.findFirst({ where: { patientId, doctorId: req.user.id } });
    allowed = !!link;
  }
  if (!allowed) return res.status(403).json({ success: false, error: 'Not authorized for this patient' });
  next();
}

module.exports = { authenticate, authorize, patientAccess };
