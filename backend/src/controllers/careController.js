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
const EXERCISE_WRITABLE = ['name', 'category', 'description', 'videoUrl', 'defaultSets', 'defaultReps', 'difficulty', 'precautions', 'startingPosition', 'bodySide', 'tempo', 'demoStatus', 'monitoringKey'];
function exerciseWriteData(body) {
  let fields = null;
  try { fields = prisma.exercise.fields || null; } catch { fields = null; }
  const data = {};
  for (const k of EXERCISE_WRITABLE) {
    if (body[k] !== undefined && (!fields || fields[k])) data[k] = body[k];
  }
  return data;
}
const createExercise = asyncHandler(async (req, res) => ok(res, await prisma.exercise.create({ data: exerciseWriteData(req.body) }), 201));
const listExercises = asyncHandler(async (req, res) => ok(res, await prisma.exercise.findMany({ orderBy: { name: 'asc' } })));
const updateExercise = asyncHandler(async (req, res) => {
  const existing = await prisma.exercise.findUnique({ where: { id: req.params.id } });
  if (!existing) return fail(res, 'Exercise not found', 404);
  return ok(res, await prisma.exercise.update({ where: { id: req.params.id }, data: exerciseWriteData(req.body) }));
});

const { resolveDemo } = require('../services/demoService');

const exerciseDemo = asyncHandler(async (req, res) => {
  const exercise = await prisma.exercise.findUnique({ where: { id: req.params.id } });
  if (!exercise) return fail(res, 'Exercise not found', 404);
  return ok(res, { exercise, resolution: resolveDemo(exercise) });
});

const assignExercise = asyncHandler(async (req, res) => {
  const { patientId, exerciseId, exerciseName, exerciseCategory, exerciseDescription, exerciseVideoUrl, sets, reps, durationMin, frequency, instructions, startDate, endDate } = req.body;
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
      exercise = await prisma.exercise.create({ data: { name, category: exerciseCategory, description: exerciseDescription, videoUrl: exerciseVideoUrl } });
    } else if (exerciseVideoUrl && !exercise.videoUrl) {
      exercise = await prisma.exercise.update({ where: { id: exercise.id }, data: { videoUrl: exerciseVideoUrl } });
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

async function checkAssignmentAccess(req, assignmentId) {
  const a = await prisma.exerciseAssignment.findUnique({ where: { id: assignmentId } });
  if (!a) return { error: 'Exercise assignment not found', status: 404 };
  if (req.user.role !== 'ADMIN') {
    const allowed = await scopedPatientIds(req.user);
    if (allowed && !allowed.includes(a.patientId)) return { error: 'Not authorized for this patient', status: 403 };
  }
  return { assignment: a };
}

const updateAssignment = asyncHandler(async (req, res) => {
  const found = await checkAssignmentAccess(req, req.params.id);
  if (found.error) return fail(res, found.error, found.status);
  const { sets, reps, durationMin, frequency, instructions, isActive } = req.body;
  const a = await prisma.exerciseAssignment.update({
    where: { id: req.params.id },
    data: {
      ...(sets !== undefined ? { sets } : {}),
      ...(reps !== undefined ? { reps } : {}),
      ...(durationMin !== undefined ? { durationMin } : {}),
      ...(frequency !== undefined ? { frequency } : {}),
      ...(instructions !== undefined ? { instructions } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });
  await audit(req.user.id, 'update_assignment', 'exercise_assignments', a.id, req.ip);
  return ok(res, a);
});

const removeAssignment = asyncHandler(async (req, res) => {
  const found = await checkAssignmentAccess(req, req.params.id);
  if (found.error) return fail(res, found.error, found.status);
  const a = await prisma.exerciseAssignment.update({ where: { id: req.params.id }, data: { isActive: false } });
  await audit(req.user.id, 'remove_assignment', 'exercise_assignments', a.id, req.ip);
  return ok(res, { message: 'Removed from plan' });
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
  // Rehab rule: repeated difficult sessions → one warning alert (deduped weekly).
  if ((req.body.difficulty || 0) >= 4) {
    const weekAgo = new Date(Date.now() - 7 * 864e5);
    const [hard, existing] = await Promise.all([
      prisma.exerciseLog.count({ where: { patientId: req.body.patientId, difficulty: { gte: 4 }, loggedAt: { gte: weekAgo } } }),
      prisma.alert.findFirst({ where: { patientId: req.body.patientId, type: 'repeated_difficulty', isRead: false, createdAt: { gte: weekAgo } } }),
    ]);
    if (hard >= 3 && !existing) {
      await prisma.alert.create({ data: { patientId: req.body.patientId, type: 'repeated_difficulty', severity: 'warning', message: 'Repeated exercise difficulty recorded this week' } });
    }
  }
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

// ---- Physiotherapy assessments ----
const createAssessment = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  const patient = await prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
  if (!patient) return fail(res, 'Patient not found', 404);
  const { assessmentType, assessmentDate, tug, walkSpeed, sitToStand, balanceScore, balanceMax, problems, observations, notes, reviewDate } = req.body;
  const { createAssessmentSafe } = require('../utils/modelSafe');
  const a = await createAssessmentSafe(prisma, {
    patientId, therapistId: req.user.id, assessmentType,
    assessmentDate: assessmentDate ? new Date(assessmentDate) : undefined,
    tug, walkSpeed, sitToStand, balanceScore, balanceMax,
    problems: problems || [],
    observations, notes,
    reviewDate: reviewDate ? new Date(reviewDate) : undefined,
  });
  await audit(req.user.id, 'create_assessment', 'physio_assessments', a.id, req.ip);
  return ok(res, a, 201);
});

const listAssessments = asyncHandler(async (req, res) => {
  const { listAssessmentsSafe } = require('../utils/modelSafe');
  return ok(res, await listAssessmentsSafe(prisma, req.params.id));
});

function measureDiff(label, prev, cur, unit, lowerIsBetter) {
  if (prev == null || cur == null) return { label, previous: prev, current: cur, difference: null, direction: 'UNKNOWN', text: 'Not recorded in both assessments.' };
  const d = Math.round((cur - prev) * 100) / 100;
  return {
    label, previous: prev, current: cur, unit, difference: d,
    direction: d === 0 ? 'NO_CHANGE' : 'RECORDED_CHANGE',
    text: d === 0 ? `No recorded change (${cur}${unit}).` : `Recorded ${cur}${unit} vs ${prev}${unit} previously.`,
    lowerIsBetter: !!lowerIsBetter,
  };
}

const compareAssessments = asyncHandler(async (req, res) => {
  const { listAssessmentsSafe } = require('../utils/modelSafe');
  const all = (await listAssessmentsSafe(prisma, req.params.id)).slice(0, 2);
  if (all.length < 2) return ok(res, { previous: all[1] || null, current: all[0] || null, comparison: [], note: 'Need at least two assessments to compare.' });
  const [current, previous] = all;
  return ok(res({
    previous, current,
    comparison: [
      measureDiff('Timed Up and Go', previous.tug, current.tug, ' sec', true),
      measureDiff('Gait speed', previous.walkSpeed, current.walkSpeed, ' m/s', false),
      measureDiff('Sit-to-Stand', previous.sitToStand, current.sitToStand, ' reps', false),
      measureDiff('Balance score', previous.balanceScore, current.balanceScore, `/${current.balanceMax || previous.balanceMax || 28}`, false),
    ],
  }));
});

// ---- Rehabilitation goals ----
const createGoal = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  const patient = await prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
  if (!patient) return fail(res, 'Patient not found', 404);
  const { title, description, status, target, reviewDate } = req.body;
  const { createGoalSafe } = require('../utils/modelSafe');
  const g = await createGoalSafe(prisma, { patientId, therapistId: req.user.id, title, description, status, target, reviewDate: reviewDate ? new Date(reviewDate) : undefined });
  await audit(req.user.id, 'create_goal', 'rehab_goals', g.id, req.ip);
  return ok(res, g, 201);
});

const listGoals = asyncHandler(async (req, res) => {
  const { listGoalsSafe } = require('../utils/modelSafe');
  return ok(res, await listGoalsSafe(prisma, req.params.id));
});

const updateGoal = asyncHandler(async (req, res) => {
  const { findGoalSafe, updateGoalSafe } = require('../utils/modelSafe');
  const existing = await findGoalSafe(prisma, req.params.id);
  if (!existing) return fail(res, 'Goal not found', 404);
  if (req.user.role !== 'ADMIN') {
    const allowed = await scopedPatientIds(req.user);
    if (allowed && !allowed.includes(existing.patientId)) return fail(res, 'Not authorized for this patient', 403);
  }
  const { title, description, status, target, reviewDate } = req.body;
  const g = await updateGoalSafe(prisma, req.params.id, {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(target !== undefined ? { target } : {}),
    ...(reviewDate !== undefined ? { reviewDate: reviewDate ? new Date(reviewDate) : null } : {}),
  });
  await audit(req.user.id, 'update_goal', 'rehab_goals', g.id, req.ip);
  return ok(res, g);
});

// ---- Rehab progress (adherence weeks + latest assessment pair + feedback) ----
const patientProgress = asyncHandler(async (req, res) => {
  const { exerciseCompletion } = require('../utils/calculations');
  const patientId = req.params.id;
  const now = new Date();
  const weeks = [];
  for (let w = 0; w < 4; w++) {
    const to = new Date(now.getTime() - w * 7 * 864e5);
    const from = new Date(to.getTime() - 7 * 864e5);
    const logs = await prisma.exerciseLog.findMany({ where: { patientId, loggedAt: { gte: from, lte: to } } });
    const stats = exerciseCompletion(logs);
    weeks.unshift({ week: `Week ${4 - w}`, completionPct: stats.completionPct, sessions: stats.completed + stats.partial });
  }
  const { listAssessmentsSafe, listGoalsSafe } = require('../utils/modelSafe');
  const assessments = (await listAssessmentsSafe(prisma, patientId)).slice(0, 2);
  const logFields = (() => { try { return prisma.exerciseLog.fields || null; } catch { return null; } })();
  const feedback = await prisma.exerciseLog.findMany({
    where: logFields && logFields.feedbackReason
      ? { patientId, OR: [{ difficulty: { not: null } }, { feedbackReason: { not: null } }] }
      : { patientId, difficulty: { not: null } },
    orderBy: { loggedAt: 'desc' }, take: 20,
    include: { assignment: { include: { exercise: true } } },
  });
  const observations = await prisma.caregiverObservation.findMany({ where: { patientId }, orderBy: { loggedAt: 'desc' }, take: 10 });
  const goals = (await listGoalsSafe(prisma, patientId)).filter((g) => g.status === 'active');
  return ok(res, {
    adherenceWeeks: weeks,
    latestAssessment: assessments[0] || null,
    previousAssessment: assessments[1] || null,
    activeGoals: goals,
    feedback: feedback.map((l) => ({
      at: l.loggedAt, exercise: l.assignment?.exercise?.name, status: l.status,
      difficulty: l.difficulty, feedbackReason: l.feedbackReason ?? null, remarks: l.remarks,
    })),
    observations: observations.map((o) => ({ at: o.loggedAt, text: o.notes || `${o.mood || ''} ${o.appetite || ''}`.trim() })),
  });
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
  // Separate: newer model may be unknown to a stale generated client.
  let asmts = [];
  try {
    asmts = await prisma.physioAssessment.findMany({ where: { patientId: { in: pids } }, orderBy: { assessmentDate: 'desc' } });
  } catch { asmts = []; }
  const latestAsmt = {};
  for (const a of asmts) {
    if (!latestAsmt[a.patientId]) latestAsmt[a.patientId] = a;
  }
  const dueSoon = Date.now() + 7 * 864e5;
  const isDue = (pid) => {
    const a = latestAsmt[pid];
    if (!a) return true;
    if (a.reviewDate && new Date(a.reviewDate).getTime() <= dueSoon) return true;
    return false;
  };
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
      const hardCount = exL.filter((l) => l.patientId === p.id && (l.difficulty || 0) >= 4).length;
      const extraAttention = [];
      if (isDue(p.id)) extraAttention.push({ level: 'amber', title: latestAsmt[p.id] ? 'Reassessment due' : 'No assessment recorded yet', detail: latestAsmt[p.id] ? 'Review date reached — reassess to update the plan.' : 'Record an initial assessment to start tracking.' });
      if (hardCount >= 3) extraAttention.push({ level: 'amber', title: 'Repeated exercise difficulty', detail: `${hardCount} recent sessions rated difficult or worse.` });
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
        lastAssessment: latestAsmt[p.id] ? latestAsmt[p.id].assessmentDate : null,
        assessmentDue: isDue(p.id),
        attention: [...extraAttention, ...ins.attention.slice(0, 3)].slice(0, 4),
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
    overview: { totalPatients: patients.length, patientsNeedingAttention: attentionPatients.length, activePlans: activePlanSet.size, assessmentsDue: patients.filter((p) => isDue(p.id)).length },
    attentionPatients,
    patients: patientsOut,
    snapshot,
    snapshotError,
    recentActivity: feed,
  });
});

module.exports = { createPatient, listPatients, getPatient, updatePatient, assignCaregiver, removeCaregiver, createCaregiver, getCaregiver, createExercise, listExercises, updateExercise, exerciseDemo, assignExercise, updateAssignment, removeAssignment, patientExercises, logExercise, exerciseHistory, createMedicine, listMedicines, assignMedicine, patientMedicines, logMedicine, medicineHistory, logSymptom, patientSymptoms, addObservation, patientObservations, listAlerts, readAlert, resolveAlert, addNote, createReport, listReports, reportPDF, caregiverDashboard, doctorDashboard, doctorDashboardV2, patientTimeline, patientInsights, patientChanges, patientSummary, patientCareTeam, patientAnalytics, createAssessment, listAssessments, compareAssessments, createGoal, listGoals, updateGoal, patientProgress };
