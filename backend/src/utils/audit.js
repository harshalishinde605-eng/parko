const { prisma } = require('../config/db');
async function audit(userId, action, entity, entityId, ip) {
  try { await prisma.auditLog.create({ data: { userId, action, entity, entityId, ip } }); } catch { /* never fail request */ }
}
module.exports = { audit };
