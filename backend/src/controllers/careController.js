const { prisma } = require('../config/db');
const { asyncHandler, ok, fail } = require('../utils/apiResponse');
const { audit } = require('../utils/audit');
const { exerciseCompletion, medicineAdherence, symptomTrend } = require('../utils/calculations');
const { evaluateAndCreateAlerts } = require('../utils/alerts');
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
const updateExercise = asyncHandler(async (req, res) => ok(res, await prisma.exercise.update({ where: { id: req.params.id }, data: req.body })));

const assignExercise = asyncHandler(async (req, res) => {
  const { patientId, exerciseId, sets, reps, durationMin, frequency, instructions, startDate, endDate } = req.body;
  const [patient, exercise] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } }),
    prisma.exercise.findUnique({ where: { id: exerciseId } }),
  ]);
  if (!patient) return fail(res, 'Patient not found', 404);
  if (!exercise) return fail(res, 'Exercise not found', 404);
  const a = await prisma.exerciseAssignment.create({
    data: { patientId, exerciseId, sets, reps, durationMin, frequency, instructions, assignedById: req.user.id, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined },
  });
  await audit(req.user.id, 'assign_exercise', 'exercise_assignments', a.id, req.ip);
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
  const log = await prisma.exerciseLog.create({ data: { ...req.body, loggedById: req.user.id } });
  await audit(req.user.id, 'log_exercise', 'exercise_logs', log.id, req.ip);
  return ok(res, log, 201);
});

const exerciseHistory = asyncHandler(async (req, res) => {
  const logs = await prisma.exerciseLog.findMany({ where: { patientId: req.params.id }, orderBy: { loggedAt: 'desc' }, take: 200, include: { assignment: { include: { exercise: true } } } });
  return ok(res, { logs, stats: exerciseCompletion(logs) });
});

// ---- Medicines ----
const createMedicine = asyncHandler(async (req, res) => ok(res, await prisma.medicine.create({ data: req.body }), 201));
const listMedicines = asyncHandler(async (req, res) => ok(res, await prisma.medicine.findMany({ orderBy: { name: 'asc' } })));
const assignMedicine = asyncHandler(async (req, res) => {
  const { patientId, medicineId, dosage, scheduleTimes, withFood, instructions } = req.body;
  const [patient, medicine] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } }),
    prisma.medicine.findUnique({ where: { id: medicineId } }),
  ]);
  if (!patient) return fail(res, 'Patient not found', 404);
  if (!medicine) return fail(res, 'Medicine not found', 404);
  const a = await prisma.medicineAssignment.create({ data: { patientId, medicineId, dosage, scheduleTimes: scheduleTimes || [], withFood: !!withFood, instructions, assignedById: req.user.id } });
  await audit(req.user.id, 'assign_medicine', 'medicine_assignments', a.id, req.ip);
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
  const log = await prisma.symptomLog.create({ data: { ...req.body, loggedById: req.user.id } });
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
  const o = await prisma.caregiverObservation.create({ data: { ...req.body, loggedById: req.user.id } });
  await evaluateAndCreateAlerts(prisma, { patientId: req.body.patientId, kind: 'observation', payload: req.body });
  await audit(req.user.id, 'add_observation', 'caregiver_observations', o.id, req.ip);
  return ok(res, o, 201);
});
const patientObservations = asyncHandler(async (req, res) => ok(res, await prisma.caregiverObservation.findMany({ where: { patientId: req.params.id }, orderBy: { loggedAt: 'desc' }, take: 100 })));

// ---- Alerts ----
const listAlerts = asyncHandler(async (req, res) => {
  const ids = await scopedPatientIds(req.user);
  const alerts = await prisma.alert.findMany({ where: { ...(ids ? { patientId: { in: ids } } : {}), ...(req.query.unread === 'true' ? { isRead: false } : {}) }, orderBy: { createdAt: 'desc' }, take: 100 });
  return ok(res, alerts);
});
const readAlert = asyncHandler(async (req, res) => ok(res, await prisma.alert.update({ where: { id: req.params.id }, data: { isRead: true } })));

// ---- Notes / Reports / Dashboard ----
const addNote = asyncHandler(async (req, res) => {
  const { patientId, note } = req.body;
  const n = await prisma.doctorNote.create({ data: { patientId, doctorId: req.user.id, note } });
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
  return buildReportPDF(res, { patient: report.patient, doctor: report.generatedBy, caregiver: links?.caregiver || null, stats, symptoms: stats.symptomsRaw, observations: stats.observations, alerts: stats.alerts, notes: stats.notes, period: `${report.periodStart.toDateString()} - ${report.periodEnd.toDateString()}` });
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
    out.push({ patient: p, exercise: stats.exercise, meds: stats.meds, symptomAvg: stats.symptoms.avg, openAlerts: stats.alerts.filter((a) => a).length });
  }
  return ok(res, out);
});

module.exports = { createPatient, listPatients, getPatient, updatePatient, assignCaregiver, removeCaregiver, createCaregiver, getCaregiver, createExercise, listExercises, updateExercise, assignExercise, patientExercises, logExercise, exerciseHistory, createMedicine, listMedicines, assignMedicine, patientMedicines, logMedicine, medicineHistory, logSymptom, patientSymptoms, addObservation, patientObservations, listAlerts, readAlert, addNote, createReport, listReports, reportPDF, caregiverDashboard, doctorDashboard };
