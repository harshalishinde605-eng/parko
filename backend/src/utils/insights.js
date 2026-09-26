// Descriptive care analytics. Everything here summarizes RECORDED data only —
// it never diagnoses, stages, or predicts. Language must stay observational.
const DAY = 24 * 3600 * 1000;

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

function windows(days = 7, now = new Date()) {
  const to = new Date(now);
  const from = new Date(now.getTime() - days * DAY);
  const prevTo = new Date(from);
  const prevFrom = new Date(from.getTime() - days * DAY);
  return { cur: { from, to }, prev: { from: prevFrom, to: prevTo } };
}

async function fetchWindow(prisma, patientId, { from, to }) {
  const [exLogs, medLogs, symptoms, observations] = await Promise.all([
    prisma.exerciseLog.findMany({ where: { patientId, loggedAt: { gte: from, lte: to } }, orderBy: { loggedAt: 'asc' } }),
    prisma.medicineLog.findMany({ where: { patientId, takenAt: { gte: from, lte: to } }, orderBy: { takenAt: 'asc' } }),
    prisma.symptomLog.findMany({ where: { patientId, loggedAt: { gte: from, lte: to } }, orderBy: { loggedAt: 'asc' } }),
    prisma.caregiverObservation.findMany({ where: { patientId, loggedAt: { gte: from, lte: to } }, orderBy: { loggedAt: 'asc' } }),
  ]);
  return { exLogs, medLogs, symptoms, observations };
}

const { exerciseCompletion, medicineAdherence, symptomTrend } = require('./calculations');

function checkinDays(...logArrays) {
  const set = new Set();
  for (const arr of logArrays) for (const l of arr) set.add(dayKey(l.loggedAt || l.takenAt));
  return set;
}

function lastNDots(daySet, n = 7, now = new Date()) {
  const dots = [];
  for (let i = n - 1; i >= 0; i--) dots.push(daySet.has(dayKey(new Date(now.getTime() - i * DAY))));
  return dots;
}

function dayBars(symptoms, type, days = 7, now = new Date()) {
  const bars = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY));
    const list = symptoms.filter((s) => s.type === type && dayKey(s.loggedAt) === key);
    bars.push({ day: key.slice(5), count: list.length, max: list.reduce((m, s) => Math.max(m, s.severity), 0) });
  }
  return bars;
}

function sessionsPerWeek(exLogs, weeks = 4, now = new Date()) {
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const to = new Date(now.getTime() - w * 7 * DAY);
    const from = new Date(to.getTime() - 7 * DAY);
    out.push(exLogs.filter((l) => l.loggedAt >= from && l.loggedAt < to && l.status !== 'missed').length);
  }
  return out;
}

function attentionFor(w) {
  const items = [];
  const ex = exerciseCompletion(w.exLogs);
  const meds = medicineAdherence(w.medLogs);
  const falls = w.observations.filter((o) => o.falls).length;
  const severe = w.symptoms.filter((s) => s.severity >= 8);
  const walking = w.symptoms.filter((s) => s.type === 'walking' || s.type === 'balance');
  if (falls > 0) items.push({ level: 'red', title: `${falls} fall${falls > 1 ? 's' : ''} recorded`, detail: 'Review the observation notes and care plan.' });
  if (severe.length > 0) items.push({ level: 'red', title: `${severe.length} severe symptom ${severe.length > 1 ? 'entries' : 'entry'} (≥8/10)`, detail: severe.slice(0, 2).map((s) => `${s.type} ${s.severity}/10`).join(' · ') });
  if (walking.length >= 3) items.push({ level: 'amber', title: `${walking.length} walking-difficulty entries this week`, detail: 'Higher than a quiet week — see timeline.' });
  if (meds.total > 0 && meds.adherencePct < 80) items.push({ level: 'amber', title: `Medication records at ${meds.adherencePct}%`, detail: `${meds.missed} missed of ${meds.total} recorded doses.` });
  if (ex.total > 0 && ex.completionPct < 60) items.push({ level: 'amber', title: `Exercise completion at ${ex.completionPct}%`, detail: `${ex.completed} completed of ${ex.total} recorded sessions.` });
  const latest = [...w.exLogs, ...w.medLogs, ...w.symptoms, ...w.observations]
    .map((l) => new Date(l.loggedAt || l.takenAt).getTime());
  if (latest.length && Math.max(...latest) < Date.now() - 2 * DAY) {
    items.push({ level: 'amber', title: 'No records in the last 48 hours', detail: 'Check whether logging has lapsed.' });
  }
  if (!items.length) {
    if (falls === 0) items.push({ level: 'green', title: 'No falls recorded', detail: 'All clear this week.' });
    if (meds.total > 0 && meds.adherencePct >= 90) items.push({ level: 'green', title: `Medication records at ${meds.adherencePct}%`, detail: 'Steady recording.' });
  }
  return { items, ex, meds, falls, severe: severe.length, walking: walking.length };
}

function changesFor(curW, prevW) {
  const c = (arr) => arr.length;
  const walk = (w) => w.symptoms.filter((s) => s.type === 'walking' || s.type === 'balance').length;
  const falls = (w) => w.observations.filter((o) => o.falls).length;
  const sev = (w) => w.symptoms.filter((s) => s.severity >= 8).length;
  const exSess = (w) => w.exLogs.filter((l) => l.status !== 'missed').length;
  const medTaken = (w) => w.medLogs.filter((l) => l.status === 'taken').length;
  const rows = [
    { domain: 'Medication records', cur: medTaken(curW), prev: medTaken(prevW), one: 'taken dose', many: 'taken doses' },
    { domain: 'Exercise', cur: exSess(curW), prev: exSess(prevW), one: 'session', many: 'sessions' },
    { domain: 'Walking difficulty', cur: walk(curW), prev: walk(prevW), one: 'entry', many: 'entries' },
    { domain: 'Falls', cur: falls(curW), prev: falls(prevW), one: 'fall', many: 'falls' },
    { domain: 'Severe entries (8+)', cur: sev(curW), prev: sev(prevW), one: 'entry', many: 'entries' },
  ];
  return rows.map((r) => {
    const d = r.cur - r.prev;
    const tone = r.domain.startsWith('Walking') || r.domain.startsWith('Falls') || r.domain.startsWith('Severe')
      ? (d > 0 ? 'amber' : 'green')
      : (d < 0 ? 'amber' : 'green');
    const unit = Math.abs(d) === 1 ? r.one : r.many;
    const text = d === 0
      ? `No major change in recorded ${r.domain.toLowerCase()} (${r.cur} vs ${r.prev}).`
      : `${Math.abs(d)} ${unit} ${d > 0 ? 'more' : 'fewer'} recorded than the previous period (${r.cur} vs ${r.prev}).`;
    return { ...r, delta: d, tone, text };
  });
}

function summaryFor(w, days) {
  const ex = exerciseCompletion(w.exLogs);
  const meds = medicineAdherence(w.medLogs);
  const byType = {};
  for (const s of w.symptoms) (byType[s.type] = byType[s.type] || []).push(s.severity);
  const daysLogged = checkinDays(w.exLogs, w.medLogs, w.symptoms, w.observations).size;
  const paras = [];
  paras.push(`Medication records were completed on ${meds.taken} of ${meds.total} recorded doses${meds.total ? ` (${meds.adherencePct}%)` : ''} in the last ${days} days.`);
  paras.push(`${ex.completed + ex.partial} exercise session${ex.completed + ex.partial === 1 ? ' was' : 's were'} recorded${ex.total ? ` (${ex.completionPct}% completion)` : ''}.`);
  const walk = byType.walking || byType.balance ? [...(byType.walking || []), ...(byType.balance || [])] : [];
  if (walk.length) paras.push(`Walking difficulty was recorded on ${walk.length} occasion${walk.length === 1 ? '' : 's'}, with entries ranging from ${Math.min(...walk)}–${Math.max(...walk)}/10.`);
  if ((byType.tremor || []).length) paras.push(`${byType.tremor.length} tremor observation${byType.tremor.length === 1 ? ' was' : 's were'} recorded.`);
  const falls = w.observations.filter((o) => o.falls).length;
  paras.push(falls ? `${falls} fall${falls === 1 ? ' was' : 's were'} recorded during this period.` : 'No falls were recorded during this period.');
  if (w.observations.length) {
    const last = w.observations[w.observations.length - 1];
    if (last.notes) paras.push(`Latest caregiver note: “${last.notes}”`);
  }
  paras.push(`Records exist for ${daysLogged} of the last ${days} days.`);
  return { paragraphs: paras, stats: { ex, meds, daysLogged, falls } };
}

async function buildInsights(prisma, patientId, days = 7) {
  const now = new Date();
  const { cur, prev } = windows(days, now);
  const [curW, prevW] = await Promise.all([fetchWindow(prisma, patientId, cur), fetchWindow(prisma, patientId, prev)]);
  const att = attentionFor(curW);
  const daysLogged = checkinDays(curW.exLogs, curW.medLogs, curW.symptoms, curW.observations);
  return {
    days,
    attention: att.items,
    stats: {
      exercise: att.ex,
      meds: att.meds,
      falls: att.falls,
      severe: att.severe,
      walking: att.walking,
      checkins: daysLogged.size,
      dots: lastNDots(daysLogged, 7, now),
    },
    symptomAvg: symptomTrend(curW.symptoms).avg,
    dayBars: {
      tremor: dayBars(curW.symptoms, 'tremor', days, now),
      walking: dayBars([...curW.symptoms], 'walking', days, now),
    },
    sessionsPerWeek: sessionsPerWeek(curW.exLogs.concat(prevW.exLogs), 4, now),
    changes: changesFor(curW, prevW),
    summary: summaryFor(curW, days),
  };
}

const SOURCE_LABEL = { CAREGIVER: 'Caregiver reported', DOCTOR: 'Doctor recorded', ADMIN: 'Care team', PATIENT: 'Patient reported' };

async function buildTimeline(prisma, patientId, daysOrOpts = 7) {
  const opts = typeof daysOrOpts === 'number' ? { days: daysOrOpts } : daysOrOpts;
  const to = opts.endDate ? new Date(`${opts.endDate}T23:59:59`) : new Date();
  const from = opts.startDate
    ? new Date(`${opts.startDate}T00:00:00`)
    : new Date(to.getTime() - (opts.days || 7) * DAY);
  const kinds = opts.kinds ? String(opts.kinds).split(',').map((k) => k.trim().toLowerCase()) : null;
  const want = (k) => !kinds || kinds.includes(k);
  const [exLogs, medLogs, symptoms, observations, notes, alerts] = await Promise.all([
    want('exercise') ? prisma.exerciseLog.findMany({ where: { patientId, loggedAt: { gte: from, lte: to } }, include: { assignment: { include: { exercise: true } }, loggedBy: { select: { role: true } } }, orderBy: { loggedAt: 'desc' }, take: 100 }) : [],
    want('medication') ? prisma.medicineLog.findMany({ where: { patientId, takenAt: { gte: from, lte: to } }, include: { assignment: { include: { medicine: true } }, loggedBy: { select: { role: true } } }, orderBy: { takenAt: 'desc' }, take: 100 }) : [],
    want('symptom') ? prisma.symptomLog.findMany({ where: { patientId, loggedAt: { gte: from, lte: to } }, include: { loggedBy: { select: { role: true } } }, orderBy: { loggedAt: 'desc' }, take: 100 }) : [],
    want('observation') ? prisma.caregiverObservation.findMany({ where: { patientId, loggedAt: { gte: from, lte: to } }, include: { loggedBy: { select: { role: true } } }, orderBy: { loggedAt: 'desc' }, take: 100 }) : [],
    want('note') ? prisma.doctorNote.findMany({ where: { patientId, createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'desc' }, take: 50 }) : [],
    want('alert') ? prisma.alert.findMany({ where: { patientId, createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'desc' }, take: 50 }) : [],
  ]);
  const src = (role) => SOURCE_LABEL[role] || 'Recorded';
  // Patch occurred_at via raw SQL: readable even when the deployed Prisma
  // Client was generated before the column existed (stale build cache).
  try {
    if (symptoms.length) {
      const rows = await prisma.$queryRawUnsafe('SELECT id, occurred_at AS "occurredAt" FROM symptom_logs WHERE id = ANY($1)', symptoms.map((s) => s.id));
      const map = Object.fromEntries(rows.map((r) => [r.id, r.occurredAt]));
      symptoms.forEach((s) => { if (map[s.id]) s.occurredAt = map[s.id]; });
    }
    if (observations.length) {
      const rows = await prisma.$queryRawUnsafe('SELECT id, occurred_at AS "occurredAt" FROM caregiver_observations WHERE id = ANY($1)', observations.map((o) => o.id));
      const map = Object.fromEntries(rows.map((r) => [r.id, r.occurredAt]));
      observations.forEach((o) => { if (map[o.id]) o.occurredAt = map[o.id]; });
    }
  } catch { /* occurred_at unavailable — fall back to logged time */ }
  const items = [
    ...exLogs.map((l) => ({ id: l.id, patientId, kind: 'exercise', source: src(l.loggedBy?.role), sourceRecordId: l.id, at: l.loggedAt, title: `${l.assignment?.exercise?.name || 'Exercise'} — ${l.status}`, detail: `Reps ${l.repsDone ?? '–'} · ${l.durationMin ?? '–'} min${l.remarks ? ` · ${l.remarks}` : ''}`, level: l.status === 'missed' ? 'amber' : 'green' })),
    ...medLogs.map((l) => ({ id: l.id, patientId, kind: 'medication', source: src(l.loggedBy?.role), sourceRecordId: l.id, at: l.takenAt, title: `${l.assignment?.medicine?.name || 'Medicine'} — ${l.status}`, detail: l.remarks || '', level: l.status === 'missed' ? 'amber' : 'green' })),
    ...symptoms.map((s) => ({ id: s.id, patientId, kind: 'symptom', source: src(s.loggedBy?.role), sourceRecordId: s.id, at: s.occurredAt || s.loggedAt, severity: s.severity, title: `${s.type} ${s.severity}/10`, detail: s.notes || '', level: s.severity >= 8 ? 'red' : s.severity >= 5 ? 'amber' : 'green' })),
    ...observations.map((o) => ({ id: o.id, patientId, kind: 'observation', source: src(o.loggedBy?.role), sourceRecordId: o.id, at: o.occurredAt || o.loggedAt, title: o.falls ? 'Fall reported' : 'Caregiver observation', detail: o.notes || `Mood ${o.mood || '–'} · Sleep ${o.sleepHours ?? '–'}h`, level: o.falls ? 'red' : 'green' })),
    ...notes.map((n) => ({ id: n.id, patientId, kind: 'note', source: 'Doctor recorded', sourceRecordId: n.id, at: n.createdAt, title: 'Doctor note', detail: n.note, level: 'info' })),
    ...alerts.map((a) => ({ id: a.id, patientId, kind: 'alert', source: 'System', sourceRecordId: a.id, at: a.createdAt, title: a.message, detail: a.type, level: a.severity === 'critical' ? 'red' : a.severity })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  const groups = {};
  for (const it of items) {
    const k = dayKey(it.at);
    (groups[k] = groups[k] || []).push(it);
  }
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), groups };
}

module.exports = { windows, fetchWindow, checkinDays, buildInsights, buildTimeline, summaryFor, changesFor, attentionFor, dayKey };
