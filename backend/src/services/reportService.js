// Longitudinal report analytics — aggregation over RECORDED logs only.
// Periods: weekly (last 7d), monthly (current calendar month), custom.
// No severity scores, no diagnoses — counts, rates and comparisons.
const { fetchWindow, checkinDays, dayKey } = require('../utils/insights');
const { exerciseCompletion, medicineAdherence } = require('../utils/calculations');

const DAY = 24 * 3600 * 1000;
const TYPES = ['tremor', 'stiffness', 'pain', 'fatigue', 'balance', 'walking', 'other'];

function resolvePeriod({ period = 'weekly', startDate, endDate }) {
  const now = new Date();
  if (period === 'monthly') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { type: 'monthly', from, to: now, days: Math.max(1, Math.ceil((now - from) / DAY)) };
  }
  if (period === 'custom') {
    if (!startDate || !endDate) { const e = new Error('startDate and endDate (YYYY-MM-DD) are required for custom reports'); e.status = 400; throw e; }
    const from = new Date(`${startDate}T00:00:00`);
    const to = new Date(`${endDate}T23:59:59`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) { const e = new Error('Invalid custom date range'); e.status = 400; throw e; }
    const days = Math.ceil((to - from) / DAY);
    if (days > 90) { const e = new Error('Custom reports are limited to 90 days'); e.status = 400; throw e; }
    return { type: 'custom', from, to, days };
  }
  const to = now;
  const from = new Date(now.getTime() - 7 * DAY);
  return { type: 'weekly', from, to, days: 7 };
}

function overlapDays(aStart, aEnd, from, to) {
  const s = aStart && aStart > from ? aStart : from;
  const e = aEnd && aEnd < to ? aEnd : to;
  if (e <= s) return 0;
  return Math.max(1, Math.ceil((e - s) / DAY));
}

function perDay(dates, from, days) {
  const out = [];
  for (let i = 0; i < days && i < 62; i++) {
    const d = new Date(from.getTime() + i * DAY);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, sessions: dates.filter((x) => x === key).length });
  }
  return out;
}

function overviewFor(w, assignments, periodDays) {
  const ex = exerciseCompletion(w.exLogs);
  const meds = medicineAdherence(w.medLogs);
  let scheduled = 0;
  for (const a of assignments.meds) {
    scheduled += Math.max(1, (a.scheduleTimes || []).length) * overlapDays(a.startDate, a.endDate, w.from, w.to);
  }
  const medBasis = scheduled > 0 ? 'schedule' : 'recorded';
  if (!scheduled) scheduled = meds.total;
  let planned = 0;
  for (const a of assignments.exs) {
    const f = (a.frequency || 'daily').toLowerCase();
    const days = overlapDays(a.startDate, a.endDate, w.from, w.to);
    planned += f.includes('week') && !f.includes('daily') ? Math.max(1, Math.ceil(days / 7)) : days;
  }
  const exBasis = planned > 0 ? 'schedule' : 'recorded';
  if (!planned) planned = ex.total;
  const checkDays = checkinDays(w.exLogs, w.medLogs, w.symptoms, w.observations);
  const falls = w.observations.filter((o) => o.falls);
  return {
    w,
    ex, meds,
    medication: {
      scheduled,
      taken: meds.taken,
      missed: meds.missed,
      delayed: meds.delayed,
      percentage: scheduled ? Math.round((meds.taken / scheduled) * 1000) / 10 : 0,
      basis: medBasis,
    },
    exercise: {
      planned,
      completed: ex.completed,
      partial: ex.partial,
      missed: ex.missed,
      percentage: planned ? Math.round(((ex.completed + ex.partial * 0.5) / planned) * 1000) / 10 : 0,
      basis: exBasis,
    },
    checkIns: { expected: periodDays, completed: checkDays.size, percentage: Math.round((checkDays.size / periodDays) * 1000) / 10 },
    falls: falls.length,
    fallEvents: falls.map((o) => ({ at: o.loggedAt, note: o.notes || '' })),
  };
}

async function buildAnalytics(prisma, patientId, opts = {}) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
  if (!patient) { const e = new Error('Patient not found'); e.status = 404; throw e; }
  const p = resolvePeriod(opts);
  const prevTo = new Date(p.from);
  const prevFrom = new Date(p.from.getTime() - (p.to - p.from));
  const [cur, prev, medAssign, exAssign, notes] = await Promise.all([
    fetchWindow(prisma, patientId, { from: p.from, to: p.to }),
    fetchWindow(prisma, patientId, { from: prevFrom, to: prevTo }),
    prisma.medicineAssignment.findMany({ where: { patientId, isActive: true } }),
    prisma.exerciseAssignment.findMany({ where: { patientId, isActive: true } }),
    prisma.caregiverObservation.findMany({ where: { patientId, loggedAt: { gte: p.from, lte: p.to } }, orderBy: { loggedAt: 'desc' }, take: 50 }),
  ]);
  const assignments = { meds: medAssign, exs: exAssign };
  const curO = overviewFor({ ...cur, from: p.from, to: p.to }, assignments, p.days);
  const prevO = overviewFor({ ...prev, from: prevFrom, to: prevTo }, assignments, p.days);

  const symptoms = {};
  for (const t of TYPES) {
    symptoms[t === 'walking' ? 'walkingDifficulty' : t] = cur.symptoms
      .filter((s) => s.type === t)
      .map((s) => ({ date: dayKey(s.loggedAt), severity: s.severity, notes: s.notes || undefined }));
  }

  const exDays = cur.exLogs.filter((l) => l.status !== 'missed').map((l) => dayKey(l.loggedAt));
  const exerciseActivity = perDay(exDays, p.from, p.days);

  const diff = (a, b) => a - b;
  const comparison = {
    exerciseSessions: { current: curO.exercise.completed, previous: prevO.exercise.completed, difference: diff(curO.exercise.completed, prevO.exercise.completed) },
    medicationRecords: { current: curO.medication.taken, previous: prevO.medication.taken, difference: diff(curO.medication.taken, prevO.medication.taken) },
    checkIns: { current: curO.checkIns.completed, previous: prevO.checkIns.completed, difference: diff(curO.checkIns.completed, prevO.checkIns.completed) },
    walkingDifficultyRecords: {
      current: cur.symptoms.filter((s) => s.type === 'walking' || s.type === 'balance').length,
      previous: prev.symptoms.filter((s) => s.type === 'walking' || s.type === 'balance').length,
      difference: 0,
    },
    tremorRecords: { current: cur.symptoms.filter((s) => s.type === 'tremor').length, previous: prev.symptoms.filter((s) => s.type === 'tremor').length, difference: 0 },
    falls: { current: curO.falls, previous: prevO.falls, difference: diff(curO.falls, prevO.falls) },
  };
  comparison.walkingDifficultyRecords.difference = diff(comparison.walkingDifficultyRecords.current, comparison.walkingDifficultyRecords.previous);
  comparison.tremorRecords.difference = diff(comparison.tremorRecords.current, comparison.tremorRecords.previous);
  for (const k of Object.keys(comparison)) {
    const d = comparison[k].difference;
    comparison[k].change = d > 0 ? 'INCREASED' : d < 0 ? 'DECREASED' : 'NO_CHANGE';
  }

  return {
    patient: { id: patient.id, name: patient.fullName },
    period: { type: p.type, start: p.from.toISOString().slice(0, 10), end: p.to.toISOString().slice(0, 10), days: p.days },
    overview: {
      medication: curO.medication,
      exercise: curO.exercise,
      checkIns: curO.checkIns,
      falls: curO.falls,
    },
    symptoms,
    exerciseActivity,
    comparison,
    falls: curO.fallEvents,
    observations: notes.map((o) => ({ at: o.loggedAt, text: o.notes || `${o.mood || ''} ${o.appetite || ''}`.trim(), falls: !!o.falls })),
  };
}

module.exports = { buildAnalytics, resolvePeriod };
