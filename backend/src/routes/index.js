const express = require('express');
const { authenticate, authorize, patientAccess } = require('../middleware/auth');
const { validate, registerSchema, loginSchema, patientSchema, exerciseSchema, exerciseAssignSchema, exerciseLogSchema, medicineSchema, medicineAssignSchema, medicineLogSchema, symptomLogSchema, observationSchema } = require('../validators/schemas');
const A = require('../controllers/authController');
const C = require('../controllers/careController');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development', time: new Date().toISOString() }));

// Auth
router.post('/auth/register', validate(registerSchema), A.register);
router.post('/auth/login', validate(loginSchema), A.login);
router.post('/auth/refresh', A.refresh);
router.post('/auth/logout', authenticate, A.logout);
router.get('/auth/me', authenticate, A.me);

// Patients
router.post('/patients', authenticate, authorize('DOCTOR', 'ADMIN'), validate(patientSchema), C.createPatient);
router.get('/patients', authenticate, C.listPatients);
router.get('/patients/:id', authenticate, patientAccess, C.getPatient);
router.put('/patients/:id', authenticate, authorize('DOCTOR', 'ADMIN'), patientAccess, C.updatePatient);
router.post('/patients/:id/caregiver', authenticate, authorize('DOCTOR', 'ADMIN'), C.assignCaregiver);
router.delete('/patients/:id/caregiver', authenticate, authorize('DOCTOR', 'ADMIN'), C.removeCaregiver);

// Caregivers
router.post('/caregivers', authenticate, authorize('DOCTOR', 'ADMIN'), C.createCaregiver);
router.get('/caregivers/:id', authenticate, authorize('DOCTOR', 'ADMIN'), C.getCaregiver);

// Exercises
router.post('/exercises', authenticate, authorize('DOCTOR', 'ADMIN'), validate(exerciseSchema), C.createExercise);
router.get('/exercises', authenticate, C.listExercises);
router.put('/exercises/:id', authenticate, authorize('DOCTOR', 'ADMIN'), C.updateExercise);
router.post('/exercise-assignments', authenticate, authorize('DOCTOR', 'ADMIN'), validate(exerciseAssignSchema), C.assignExercise);
router.get('/patients/:id/exercises', authenticate, patientAccess, C.patientExercises);
router.post('/exercise-logs', authenticate, authorize('CAREGIVER', 'ADMIN'), validate(exerciseLogSchema), C.logExercise);
router.get('/patients/:id/exercise-history', authenticate, patientAccess, C.exerciseHistory);

// Medicines
router.post('/medicines', authenticate, authorize('DOCTOR', 'ADMIN'), validate(medicineSchema), C.createMedicine);
router.get('/medicines', authenticate, C.listMedicines);
router.post('/medicine-assignments', authenticate, authorize('DOCTOR', 'ADMIN'), validate(medicineAssignSchema), C.assignMedicine);
router.get('/patients/:id/medicines', authenticate, patientAccess, C.patientMedicines);
router.post('/medicine-logs', authenticate, authorize('CAREGIVER', 'ADMIN'), validate(medicineLogSchema), C.logMedicine);
router.get('/patients/:id/medicine-history', authenticate, patientAccess, C.medicineHistory);

// Symptoms + observations
router.post('/symptom-logs', authenticate, authorize('CAREGIVER', 'ADMIN'), validate(symptomLogSchema), C.logSymptom);
router.get('/patients/:id/symptoms', authenticate, patientAccess, C.patientSymptoms);
router.get('/patients/:id/symptom-trends', authenticate, patientAccess, C.patientSymptoms);
router.post('/observations', authenticate, authorize('CAREGIVER', 'ADMIN'), validate(observationSchema), C.addObservation);
router.get('/patients/:id/observations', authenticate, patientAccess, C.patientObservations);

// Intelligence: timeline, insights, changes, summary, care team
router.get('/patients/:id/timeline', authenticate, patientAccess, C.patientTimeline);
router.get('/patients/:id/insights', authenticate, patientAccess, C.patientInsights);
router.get('/patients/:id/changes', authenticate, patientAccess, C.patientChanges);
router.get('/patients/:id/summary', authenticate, patientAccess, C.patientSummary);
router.get('/patients/:id/care-team', authenticate, patientAccess, C.patientCareTeam);
router.get('/patients/:id/analytics', authenticate, patientAccess, C.patientAnalytics);

// Notes, alerts, reports, dashboards
router.post('/notes', authenticate, authorize('DOCTOR', 'ADMIN'), C.addNote);
router.get('/alerts', authenticate, C.listAlerts);
router.put('/alerts/:id/read', authenticate, C.readAlert);
router.get('/patients/:id/reports', authenticate, patientAccess, C.listReports);
router.post('/patients/:id/reports', authenticate, patientAccess, C.createReport);
router.get('/reports/:id/pdf', authenticate, C.reportPDF);
router.get('/dashboard/caregiver', authenticate, authorize('CAREGIVER', 'ADMIN'), C.caregiverDashboard);
router.get('/dashboard/doctor', authenticate, authorize('DOCTOR', 'ADMIN'), C.doctorDashboard);
router.get('/doctor/dashboard', authenticate, authorize('DOCTOR', 'ADMIN'), C.doctorDashboardV2);

module.exports = router;
