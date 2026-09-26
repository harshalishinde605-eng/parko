const { prisma } = require('../config/db');
const { asyncHandler, ok, fail } = require('../utils/apiResponse');
const { audit } = require('../utils/audit');
const { exerciseCompletion, medicineAdherence, symptomTrend } = require('../utils/calculations');
const { evaluateAndCreateAlerts } = require('../utils/alerts');
const { buildInsights, buildTimeline } = require('../utils/insights');
const { buildReportPDF } = require('../utils/pdf');

async function scopedPatientIds(user) {
  if (user.role === 'ADMIN') return null;
  if (user.role === 'DOCTOR') {
    const links = await prisma.patientDoctor.findMany({ where: { doctorId: user.id } });
    return links.map((l) => l.patientId);
  }
  const links = await prisma.patientCaregiver.findMany({ where: { caregiverId: user.id } });
  return links.map((l) => l.patientId);
}

// ---- Patients ----
const createPatient = asyncHandler(async (req, res) => {
  const { fullName, dob, gender, diagnosisStage, notes } = req.body;
  const patient = await prisma.patient.create({ data: { fullName, dob: dob ? new Date(dob) : undefined, gender, diagnosisStage, notes } });
  if (req.user.role === 'DOCTOR') await prisma.patientDoctor.create({ data: { patientId: patient.id, doctorId: req.user.id } });
  await audit(req.user.id, 'create_patient', 'patients', patient.id, req.ip);
  return ok(res, patient, 201);
});

const listPatients = asyncHandler(async (req, res) => {
  const ids = await scopedPatientIds(req.user);
  const where = { deletedAt: null, ...(ids ? { id: { in: ids } } : {}) };
  const patients = await prisma.patient.findMany({ where, orderBy: { createdAt: 'desc' } });
  return ok(res, patients);
});

const getPatient = asyncHandler(async (req, res) => {
  const patient = await prisma.patient.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!patient) return fail(res, 'Not found', 404);
  return ok(res, patient);
});

const updatePatient = asyncHandler(async (req, res) => {
  const { fullName, dob, gender, diagnosisStage, notes } = req.body;
  const existing = await prisma.patient.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!existing) return fail(res, 'Patient not found', 404);
  const patient = await prisma.patient.update({
    where: { id: req.params.id },
    data: {
      ...(fullName !== undefined ? { fullName } : {}),
      ...(dob !== undefined ? { dob: dob ? new Date(dob) : null } : {}),
      ...(gender !== undefined ? { gender } : {}),
      ...(diagnosisStage !== undefined ? { diagnosisStage } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  });
  await audit(req.user.id, 'update_patient', 'patients', patient.id, req.ip);
  return ok(res, patient);
});

const assignCaregiver = asyncHandler(async (req, res) => {
  const { caregiverEmail, caregiverId } = req.body;
  let cgId = caregiverId;
  if (!cgId && caregiverEmail) {
    const u = await prisma.user.findUnique({ where: { email: caregiverEmail } });
    if (!u || u.role !== 'CAREGIVER') return fail(res, 'Caregiver not found', 404);
    cgId = u.id;
  }
  if (!cgId) return fail(res, 'caregiverId or caregiverEmail required', 400);
  const patient = await prisma.patient.findFirst({ where: { id: req.params.id, deletedAt: null } });
  if (!patient) return fail(res, 'Patient not found', 404);
  const link = await prisma.patientCaregiver.upsert({
    where: { patientId_caregiverId: { patientId: req.params.id, caregiverId: cgId } },
    update: {}, create: { patientId: req.params.id, caregiverId: cgId },
  });
  await audit(req.user.id, 'assign_caregiver', 'patients', req.params.id, req.ip);
  await prisma.alert.create({ data: { patientId: req.params.id, type: 'care_team', severity: 'info', message: 'A caregiver was linked to this patient' } });
  return ok(res, link, 201);
});

const removeCaregiver = asyncHandler(async (req, res) => {
  const { caregiverId } = req.body;
  await prisma.patientCaregiver.deleteMany({ where: { patientId: req.params.id, ...(caregiverId ? { caregiverId } : {}) } });
  return ok(res, { message: 'Removed' });
});

// ---- Caregivers ----
const createCaregiver = asyncHandler(async (req, res) => {
  const { email, password, fullName, phone, relation } = req.body;
  if (!email || !password || !fullName) return fail(res, 'email, password, fullName required', 400);
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail(res, 'Email already registered', 409);
  const { hashPassword } = require('../utils/password');
  const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), fullName, role: 'CAREGIVER' } });
  await prisma.caregiver.create({ data: { userId: user.id, phone, relation } });
  await audit(req.user.id, 'create_caregiver', 'users', user.id, req.ip);
  return ok(res, { id: user.id, email: user.email, fullName: user.fullName, role: user.role }, 201);
});

const getCaregiver = asyncHandler(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.params.id, role: 'CAREGIVER', deletedAt: null }, include: { caregiverProfile: true } });
  if (!user) return fail(res, 'Caregiver not found', 404);
  const links = await prisma.patientCaregiver.findMany({ where: { caregiverId: user.id }, include: { patient: true } });
  return ok(res, { id: user.id, email: user.email, fullName: user.fullName, profile: user.caregiverProfile, patients: links.map((l) => l.patient) });
});

// ---- Exercises ----
const createExercise = asyncHandler(async (req, res) => ok(res, await prisma.exercise.create({ data: req.body }), 201));
const listExercises = asyncHandler(async (req, res) => ok(res, await prisma.exercise.findMany({ orderBy: { name: 'asc' } })));
const updateExercise = asyncHandler(async (req, res) => {
  const existing = await prisma.exercise.findUnique({ where: { id: req.params.id } });
  if (!existing) return fail(res, 'Exercise not found', 404);
  const { name, category, description, videoUrl, defaultSets, defaultReps } = req.body;
  return ok(res, await prisma.exercise.update({ where: { id: req.params.id }, data: { name, category, description, videoUrl, defaultSets, defaultReps } }));
});

const assignExercise = asyncHandler(async (req, res) => {
  const { patientId, exerciseId, exerciseName, exerciseCategory, exerciseDescription, sets, reps, durationMin, frequency, instructions, startDate, endDate } = req.body;
  const patient = await prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
  if (!patient) return fail(res, 'Patient not found', 404);
  let exercise = null;
  if (exerciseId) {
    exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) return fail(res, 'Exercise not found', 404);
  } else {
    // Doctor typed a name: reuse existing exercise or create it on the fly.
    const name = exerciseName.trim();
    exercise = await prisma.exercise.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    if (!exercise) {
      exercise = await prisma.exercise.create({ data: { name, category: exerciseCategory, description: exerciseDescription } });
    }
  }
  const a = await prisma.exerciseAssignment.create({
    data: { patientId, exerciseId: exercise.id, sets, reps, durationMin, frequency, instructions, assignedById: req.user.id, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined },
  });
  await audit(req.user.id, 'assign_exercise', 'exercise_assignments', a.id, req.ip);
  await prisma.alert.create({ data: { patientId, type: 'assignment', severity: 'info', message: `New exercise assigned: ${exercise.name}` } });
  return ok(res, a, 201);
});

const patientExercises = asyncHandler(async (req, res) => {
  const list = await prisma.exerciseAssignment.findMany({ where: { patientId: req.params.id, isActive: true }, include: { exercise: true } });
  return ok(res, list);
});

const logExercise = asyncHandler(async (req, res) => {
  const assignment = await prisma.exerciseAssignment.findUnique({ where: { id: req.body.assignmentId } });
  if (!assignment) return fail(res, 'Exercise assignment not found', 404);
  if (assignment.patientId !== req.body.patientId) return fail(res, 'Assignment does not belong to this patient', 400);
  // AI fields only when the deployed Prisma Client knows them (stale build caches may lag behind migrations).
  const aiSupported = (() => { try { return !!(prisma.exerciseLog.fields && prisma.exerciseLog.fields.aiAssisted); } catch { return false; } })();
  const { aiAssisted, detectedReps, durationSec, avgConfidence, romSummary, formNotes, ...rest } = req.body;
  const aiData = aiSupported && aiAssisted ? { aiAssisted: true, detectedReps, durationSec, avgConfidence, romSummary, formNotes } : {};
  const log = await prisma.exerciseLog.create({ data: { ...rest, ...aiData, loggedById: req.user.id } });
  await audit(req.user.id, 'log_exercise', 'exercise_logs', log.id, req.ip);
  return ok(res, { ...log, aiStored: aiSupported && !!aiAssisted }, 201);
});

const exerciseHistory = asyncHandler(async (req, res) => {
  const logs = await prisma.exerciseLog.findMany({ where: { patientId: req.params.id }, orderBy: { loggedAt: 'desc' }, take: 200, include: { assignment: { include: { exercise: true } } } });
  return ok(res, { logs, stats: exerciseCompletion(logs) });
});

// ---- Medicines ----
const createMedicine = asyncHandler(async (req, res) => ok(res, await prisma.medicine.create({ data: req.body }), 201));
const listMedicines = asyncHandler(async (req, res) => ok(res, await prisma.medicine.findMany({ orderBy: { name: 'asc' } })));
const assignMedicine = asyncHandler(async (req, res) => {
  const { patientId, medicineId, medicineName, medicineStrength, medicineForm, dosage, scheduleTimes, withFood, instructions } = req.body;
  const patient = await prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
  if (!patient) return fail(res, 'Patient not found', 404);
  let medicine = null;
  if (medicineId) {
    medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
    if (!medicine) return fail(res, 'Medicine not found', 404);
  } else {
    // Doctor typed a name: reuse existing medicine or create it on the fly.
    const name = medicineName.trim();
    const where = { name: { equals: name, mode: 'insensitive' } };
    if (medicineStrength) where.strength = medicineStrength;
    medicine = await prisma.medicine.findFirst({ where });
    if (!medicine) {
      medicine = await prisma.medicine.create({ data: { name, strength: medicineStrength, form: medicineForm } });
    }
  }
  const a = await prisma.medicineAssignment.create({ data: { patientId, medicineId: medicine.id, dosage, scheduleTimes: scheduleTimes || [], withFood: !!withFood, instructions, assignedById: req.user.id } });
  await audit(req.user.id, 'assign_medicine', 'medicine_assignments', a.id, req.ip);
  await prisma.alert.create({ data: { patientId, type: 'assignment', severity: 'info', message: `New medicine assigned: ${medicine.name}` } });
  return ok(res, a, 201);
});
const patientMedicines = asyncHandler(async (req, res) => {
  const list = await prisma.medicineAssignment.findMany({ where: { patientId: req.params.id, isActive: true }, include: { medicine: true } });
  return ok(res, list);
});
const logMedicine = asyncHandler(async (req, res) => {
  const assignment = await prisma.medicineAssignment.findUnique({ where: { id: req.body.assignmentId } });
  if (!assignment) return fail(res, 'Medicine assignment not found', 404);
  if (assignment.patientId !== req.body.patientId) return fail(res, 'Assignment does not belong to this patient', 400);
  const log = await prisma.medicineLog.create({ data: { ...req.body, loggedById: req.user.id } });
  await evaluateAndCreateAlerts(prisma, { patientId: req.body.patientId, kind: 'medicine', payload: req.body });
  await audit(req.user.id, 'log_medicine', 'medicine_logs', log.id, req.ip);
  return ok(res, log, 201);
});
const medicineHistory = asyncHandler(async (req, res) => {
  const logs = await prisma.medicineLog.findMany({ where: { patientId: req.params.id }, orderBy: { takenAt: 'desc' }, take: 200, include: { assignment: { include: { medicine: true } } } });
  return ok(res, { logs, stats: medicineAdherence(logs) });
});

// ---- Symptoms / Observations ----
const logSymptom = asyncHandler(async (req, res) => {
  const patient = await prisma.patient.findFirst({ where: { id: req.body.patientId, deletedAt: null } });
  if (!patient) return fail(res, 'Patient not found', 404);
  const occurredAt = req.body.occurredAt && !Number.isNaN(new Date(req.body.occurredAt).getTime()) ? new Date(req.body.occurredAt) : null;
  const { occurredAt: _drop1, ...symptomData } = req.body;
  const log = await prisma.symptomLog.create({ data: { ...symptomData, loggedById: req.user.id } });
  if (occurredAt) await prisma.$executeRawUnsafe('UPDATE symptom_logs SET occurred_at = $1 WHERE id = $2', occurredAt, log.id);
  await evaluateAndCreateAlerts(prisma, { patientId: req.body.patientId, kind: 'symptom', payload: req.body });
  await audit(req.user.id, 'log_symptom', 'symptom_logs', log.id, req.ip);
  return ok(res, log, 201);
});
const patientSymptoms = asyncHandler(async (req, res) => {
  const logs = await prisma.symptomLog.findMany({ where: { patientId: req.params.id }, orderBy: { loggedAt: 'desc' }, take: 200 });
  return ok(res, { logs, trends: symptomTrend(logs) });
});
const addObservation = asyncHandler(async (req, res) => {
  const patient = await prisma.patient.findFirst({ where: { id: req.body.patientId, deletedAt: null } });
  if (!patient) return fail(res, 'Patient not found', 404);
  const occurredAt = req.body.occurredAt && !Number.isNaN(new Date(req.body.occurredAt).getTime()) ? new Date(req.body.occurredAt) : null;
  const { occurredAt: _drop2, ...obsData } = req.body;
  const o = await prisma.caregiverObservation.create({ data: { ...obsData, loggedById: req.user.id } });
  if (occurredAt) await prisma.$executeRawUnsafe('UPDATE caregiver_observations SET occurred_at = $1 WHERE id = $2', occurredAt, o.id);
  await evaluateAndCreateAlerts(prisma, { patientId: req.body.patientId, kind: 'observation', payload: req.body });
  await audit(req.user.id, 'add_observation', 'caregiver_observations', o.id, req.ip);
  return ok(res, o, 201);
});
const patientObservations = asyncHandler(async (req, res) => ok(res, await prisma.caregiverObservation.findMany({ where: { patientId: req.params.id }, orderBy: { loggedAt: 'desc' }, take: 100 })));

// ---- Alerts ----
const listAlerts = asyncHandler(async (req, res) => {
  const ids = await scopedPatientIds(req.user);
  const alerts = await prisma.alert.findMany({ where: { ...(ids ? { patientId: { in: ids } } : {}), ...(req.query.unread === 'true' ? { isRead: false } : {}) }, include: { patient: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  return ok(res, alerts);
});
const resolveAlert = asyncHandler(async (req, res) => {
  const existing = await prisma.alert.findUnique({ where: { id: req.params.id } });
  if (!existing) return fail(res, 'Alert not found', 404);
  await audit(req.user.id, 'resolve_alert', 'alerts', existing.id, req.ip);
  await prisma.alert.update({ where: { id: req.params.id }, data: { isRead: true } });
  await prisma.$executeRawUnsafe('UPDATE alerts SET resolved_at = NOW() WHERE id = $1', req.params.id);
  return ok(res, await prisma.alert.findUnique({ where: { id: req.params.id } }));
});
const readAlert = asyncHandler(async (req, res) => {
  const existing = await prisma.alert.findUnique({ where: { id: req.params.id } });
  if (!existing) return fail(res, 'Alert not found', 404);
  return ok(res, await prisma.alert.update({ where: { id: req.params.id }, data: { isRead: true } }));
});

// ---- Notes / Reports / Dashboard ----
const addNote = asyncHandler(async (req, res) => {
  const { patientId, note } = req.body;
  const n = await prisma.doctorNote.create({ data: { patientId, doctorId: req.user.id, note } });
  await prisma.alert.create({ data: { patientId, type: 'note', severity: 'info', message: 'A clinical note was added' } });
  return ok(res, n, 201);
});

async function gatherStats(patientId, from, to) {
  const [exLogs, medLogs, symptoms, observations, alerts, notes] = await Promise.all([
    prisma.exerciseLog.findMany({ where: { patientId, loggedAt: { gte: from, lte: to } } }),
    prisma.medicineLog.findMany({ where: { patientId, takenAt: { gte: from, lte: to } } }),
    prisma.symptomLog.findMany({ where: { patientId, loggedAt: { gte: from, lte: to } } }),
    prisma.caregiverObservation.findMany({ where: { patientId, loggedAt: { gte: from, lte: to } } }),
    prisma.alert.findMany({ where: { patientId, createdAt: { gte: from, lte: to } } }),
    prisma.doctorNote.findMany({ where: { patientId } }),
  ]);
  return { exercise: exerciseCompletion(exLogs), meds: medicineAdherence(medLogs), symptoms: symptomTrend(symptoms), observations, alerts, notes, exLogs, medLogs, symptomsRaw: symptoms };
}

const createReport = asyncHandler(async (req, res) => {
  const { type = 'daily', periodStart, periodEnd } = req.body;
  const patientId = req.params.id;
  const to = periodEnd ? new Date(periodEnd) : new Date();
  const from = periodStart ? new Date(periodStart) : new Date(Date.now() - 24 * 3600 * 1000);
  const stats = await gatherStats(patientId, from, to);
  const report = await prisma.report.create({ data: { patientId, type, periodStart: from, periodEnd: to, summary: { exercise: stats.exercise, meds: stats.meds, symptoms: stats.symptoms.avg }, generatedById: req.user.id } });
  return ok(res, report, 201);
});
const listReports = asyncHandler(async (req, res) => ok(res, await prisma.report.findMany({ where: { patientId: req.params.id }, orderBy: { createdAt: 'desc' } })));
const reportPDF = asyncHandler(async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { patient: true, generatedBy: true } });
  if (!report) return fail(res, 'Not found', 404);
  const stats = await gatherStats(report.patientId, report.periodStart, report.periodEnd);
  const links = await prisma.patientCaregiver.findFirst({ where: { patientId: report.patientId }, include: { caregiver: true } });
  const { fetchWindow, changesFor } = require('../utils/insights');
  const span = report.periodEnd - report.periodStart;
  const prev = await fetchWindow(prisma, report.patientId, { from: new Date(report.periodStart - span), to: report.periodStart });
  const cur = { exLogs: stats.exLogs, medLogs: stats.medLogs, symptoms: stats.symptomsRaw, observations: stats.observations };
  const comparison = changesFor(cur, prev);
  const symptomRecords = (stats.symptomsRaw || []).map((s) => ({ at: s.loggedAt, type: s.type, severity: s.severity, notes: s.notes }));
  return buildReportPDF(res, { patient: report.patient, doctor: report.generatedBy, caregiver: links?.caregiver || null, stats, symptoms: stats.symptomsRaw, observations: stats.observations, alerts: stats.alerts, notes: stats.notes, period: `${report.periodStart.toDateString()} - ${report.periodEnd.toDateString()}`, comparison, symptomRecords });
});

const caregiverDashboard = asyncHandler(async (req, res) => {
  const ids = await scopedPatientIds(req.user);
  const patients = await prisma.patient.findMany({ where: { id: { in: ids || [] } }, include: { exercises: { where: { isActive: true }, include: { exercise: true } }, medicines: { where: { isActive: true }, include: { medicine: true } } } });
  const alerts = await prisma.alert.findMany({ where: { patientId: { in: ids || [] }, isRead: false }, take: 20, orderBy: { createdAt: 'desc' } });
  return ok(res, { patients, alerts });
});

const doctorDashboard = asyncHandler(async (req, res) => {
  const ids = await scopedPatientIds(req.user);
  const patients = await prisma.patient.findMany({ where: { ...(ids ? { id: { in: ids } } : {}), deletedAt: null } });
  const out = [];
  for (const p of patients) {
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const stats = await gatherStats(p.id, from, new Date());
    const ins = await buildInsights(prisma, p.id, 7);
    out.push({
      patient: p, exercise: stats.exercise, meds: stats.meds, symptomAvg: stats.symptoms.avg,
      openAlerts: stats.alerts.filter((a) => a).length,
      attention: ins.attention.slice(0, 3), checkins: ins.stats.checkins, falls: ins.stats.falls,
    });
  }
  return ok(res, out);
});

// ---- Intelligence: timeline, insights, changes, summary, care team ----
const patientTimeline = asyncHandler(async (req, res) => {
  const days = Math.min(30, Math.max(1, parseInt(req.query.days || '7', 10)));
  const { startDate, endDate, kinds } = req.query;
  return ok(res, await buildTimeline(prisma, req.params.id, { days, startDate, endDate, kinds }));
});

const patientInsights = asyncHandler(async (req, res) => {
  const days = Math.min(30, Math.max(1, parseInt(req.query.days || '7', 10)));
  return ok(res, await buildInsights(prisma, req.params.id, days));
});

const patientChanges = asyncHandler(async (req, res) => {
  const ins = await buildInsights(prisma, req.params.id, 7);
  return ok(res, { days: 7, changes: ins.changes });
});

const patientSummary = asyncHandler(async (req, res) => {
  const days = Math.min(30, Math.max(1, parseInt(req.query.days || '7', 10)));
  const ins = await buildInsights(prisma, req.params.id, days);
  return ok(res, { days, paragraphs: ins.summary.paragraphs, stats: ins.summary.stats });
});

const patientCareTeam = asyncHandler(async (req, res) => {
  const [cgs, docs] = await Promise.all([
    prisma.patientCaregiver.findMany({ where: { patientId: req.params.id }, include: { caregiver: { select: { id: true, fullName: true, email: true } } } }),
    prisma.patientDoctor.findMany({ where: { patientId: req.params.id }, include: { doctor: { select: { id: true, fullName: true, email: true } } } }),
  ]);
  return ok(res, { caregivers: cgs.map((l) => l.caregiver), doctors: docs.map((l) => l.doctor) });
});

const { buildAnalytics } = require('../services/reportService');

const patientAnalytics = asyncHandler(async (req, res) => {
  const { period = 'weekly', startDate, endDate } = req.query;
  return ok(res, await buildAnalytics(prisma, req.params.id, { period, startDate, endDate }));
});

const doctorDashboardV2 = asyncHandler(async (req, res) => {
  const { generateSnapshot } = require('../services/snapshotService');
  const ids = await scopedPatientIds(req.user);
  const patients = await prisma.patient.findMany({ where: { ...(ids ? { id: { in: ids } } : {}), deletedAt: null }, orderBy: { fullName: 'asc' } });
  const pids = patients.map((p) => p.id);
  const byId = Object.fromEntries(patients.map((p) => [p.id, p]));

  // Batched (no N+1): last activity, active plans, recent activity feed.
  const [exL, medL, symL, obsL, exA, medA] = await Promise.all([
    prisma.exerciseLog.findMany({ where: { patientId: { in: pids } }, orderBy: { loggedAt: 'desc' }, take: 60, include: { assignment: { include: { exercise: true } } } }),
    prisma.medicineLog.findMany({ where: { patientId: { in: pids } }, orderBy: { takenAt: 'desc' }, take: 60, include: { assignment: { include: { medicine: true } } } }),
    prisma.symptomLog.findMany({ where: { patientId: { in: pids } }, orderBy: { loggedAt: 'desc' }, take: 60 }),
    prisma.caregiverObservation.findMany({ where: { patientId: { in: pids } }, orderBy: { loggedAt: 'desc' }, take: 60 }),
    prisma.exerciseAssignment.findMany({ where: { patientId: { in: pids }, isActive: true }, select: { patientId: true } }),
    prisma.medicineAssignment.findMany({ where: { patientId: { in: pids }, isActive: true }, select: { patientId: true } }),
  ]);
  const lastActive = {};
  const touch = (pid, d) => {
    const t = new Date(d).getTime();
    if (!lastActive[pid] || t > lastActive[pid]) lastActive[pid] = t;
  };
  exL.forEach((l) => touch(l.patientId, l.loggedAt));
  medL.forEach((l) => touch(l.patientId, l.takenAt));
  symL.forEach((s) => touch(s.patientId, s.loggedAt));
  obsL.forEach((o) => touch(o.patientId, o.loggedAt));
  const activePlanSet = new Set([...exA.map((a) => a.patientId), ...medA.map((a) => a.patientId)]);

  const patientsOut = [];
  const attentionPatients = [];
  for (const p of patients) {
    try {
      const ins = await buildInsights(prisma, p.id, 7);
      const row = {
        patientId: p.id,
        name: p.fullName,
        diagnosisStage: p.diagnosisStage,
        medicationRate: ins.stats.meds.adherencePct,
        exerciseRate: ins.stats.exercise.completionPct,
        checkInRate: Math.round((ins.stats.checkins / 7) * 1000) / 10,
        walkingDifficultyRecords: ins.stats.walking,
        tremorRecords: (ins.dayBars?.tremor || []).reduce((a, b) => a + b.count, 0),
        falls: ins.stats.falls,
        lastActive: lastActive[p.id] ? new Date(lastActive[p.id]).toISOString() : null,
        attention: ins.attention.slice(0, 3),
      };
      patientsOut.push(row);
      if (ins.attention.some((a) => a.level === 'red' || a.level === 'amber')) attentionPatients.push(row);
    } catch (e) {
      const { logger } = require('../utils/logger');
      logger.error('dashboard patient skipped', { patientId: p.id, error: e.message });
    }
  }

  const feed = [
    ...exL.map((l) => ({ at: l.loggedAt, kind: 'exercise', patientId: l.patientId, patientName: byId[l.patientId]?.fullName, title: `${l.assignment?.exercise?.name || 'Exercise'} — ${l.status}`, detail: `Reps ${l.repsDone ?? '–'}`, level: l.status === 'missed' ? 'amber' : 'green' })),
    ...medL.map((l) => ({ at: l.takenAt, kind: 'medication', patientId: l.patientId, patientName: byId[l.patientId]?.fullName, title: `${l.assignment?.medicine?.name || 'Medicine'} — recorded as ${l.status}`, detail: l.remarks || '', level: l.status === 'missed' ? 'amber' : 'green' })),
    ...symL.map((s) => ({ at: s.loggedAt, kind: 'symptom', patientId: s.patientId, patientName: byId[s.patientId]?.fullName, title: `${s.type} recorded (${s.severity}/10)`, detail: s.notes || '', level: s.severity >= 8 ? 'red' : 'amber' })),
    ...obsL.map((o) => ({ at: o.loggedAt, kind: 'observation', patientId: o.patientId, patientName: byId[o.patientId]?.fullName, title: o.falls ? 'Fall recorded — review details' : 'Caregiver observation added', detail: o.notes || '', level: o.falls ? 'red' : 'info' })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 15);

  let snapshot = null;
  let snapshotError = null;
  const snapPatient = attentionPatients[0] || patientsOut[0];
  if (snapPatient) {
    try {
      const s = await generateSnapshot(prisma, { patientId: snapPatient.patientId, doctorId: req.user.id, days: 7 });
      const p = byId[snapPatient.patientId];
      snapshot = {
        patientId: p.id, name: p.fullName,
        period: s.structured.period,
        medication: s.structured.medication, exercise: s.structured.exercise,
        checkins: s.structured.checkIns, falls: s.structured.falls,
        records: { sessions: s.structured.exercise.completed, walking: s.structured.symptoms.walkingDifficulty, tremor: s.structured.symptoms.tremor },
        paragraphs: s.paragraphs, engine: s.engine, cached: s.cached, disclaimer: s.disclaimer,
      };
    } catch (e) {
      const { logger } = require('../utils/logger');
      logger.error('dashboard snapshot skipped', { error: e.message });
      snapshotError = 'Snapshot temporarily unavailable';
    }
  }

  return ok(res, {
    doctor: { id: req.user.id, name: req.user.fullName },
    overview: { totalPatients: patients.length, patientsNeedingAttention: attentionPatients.length, activePlans: activePlanSet.size },
    attentionPatients,
    patients: patientsOut,
    snapshot,
    snapshotError,
    recentActivity: feed,
  });
});

module.exports = { createPatient, listPatients, getPatient, updatePatient, assignCaregiver, removeCaregiver, createCaregiver, getCaregiver, createExercise, listExercises, updateExercise, assignExercise, patientExercises, logExercise, exerciseHistory, createMedicine, listMedicines, assignMedicine, patientMedicines, logMedicine, medicineHistory, logSymptom, patientSymptoms, addObservation, patientObservations, listAlerts, readAlert, resolveAlert, addNote, createReport, listReports, reportPDF, caregiverDashboard, doctorDashboard, doctorDashboardV2, patientTimeline, patientInsights, patientChanges, patientSummary, patientCareTeam, patientAnalytics };
