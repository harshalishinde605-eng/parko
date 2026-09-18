async function evaluateAndCreateAlerts(prisma, { patientId, kind, payload }) {
  const alerts = [];
  if (kind === 'symptom' && payload.severity >= 8) {
    alerts.push({ patientId, type: 'severe_symptom', severity: 'critical', message: `Severe ${payload.type} (severity ${payload.severity}) logged` });
  }
  if (kind === 'observation' && payload.falls) {
    alerts.push({ patientId, type: 'fall', severity: 'critical', message: 'Fall reported by caregiver' });
  }
  if (kind === 'medicine' && payload.status === 'missed') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const count = await prisma.medicineLog.count({ where: { patientId, status: 'missed', takenAt: { gte: today } } });
    if (count >= 2) alerts.push({ patientId, type: 'missed_meds', severity: 'warning', message: `${count} missed doses today` });
  }
  for (const a of alerts) await prisma.alert.create({ data: a });
  return alerts;
}
module.exports = { evaluateAndCreateAlerts };
