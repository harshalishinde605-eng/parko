const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email(), password: z.string().min(8), fullName: z.string().min(2), role: z.enum(['DOCTOR', 'CAREGIVER', 'ADMIN']).default('CAREGIVER'),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const patientSchema = z.object({ fullName: z.string().min(2), dob: z.string().optional(), gender: z.string().optional(), diagnosisStage: z.string().optional(), notes: z.string().optional() });
const exerciseSchema = z.object({ name: z.string().min(2), category: z.string().optional(), description: z.string().optional(), videoUrl: z.string().optional(), defaultSets: z.number().optional(), defaultReps: z.number().optional(), startingPosition: z.string().optional(), bodySide: z.string().optional(), tempo: z.string().optional(), demoStatus: z.enum(['SUPPORTED', 'COMPOSED', 'UNSUPPORTED']).optional(), monitoringKey: z.string().optional() });
const exerciseAssignSchema = z.object({ patientId: z.string(), exerciseId: z.string().optional(), exerciseName: z.string().min(2).optional(), exerciseCategory: z.string().optional(), exerciseDescription: z.string().optional(), exerciseVideoUrl: z.string().optional(), sets: z.number().default(1), reps: z.number().default(10), durationMin: z.number().optional(), frequency: z.string().default('daily'), instructions: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional() }).refine((d) => d.exerciseId || d.exerciseName, { message: 'exerciseId or exerciseName is required' });
const exerciseLogSchema = z.object({ assignmentId: z.string(), patientId: z.string(), status: z.enum(['completed', 'partial', 'missed']), repsDone: z.number().optional(), durationMin: z.number().optional(), difficulty: z.number().min(1).max(5).optional(), remarks: z.string().optional(), aiAssisted: z.boolean().default(false), detectedReps: z.number().min(0).optional(), durationSec: z.number().min(0).optional(), avgConfidence: z.number().min(0).max(100).optional(), romSummary: z.string().max(500).optional(), formNotes: z.string().max(1000).optional() });
const medicineSchema = z.object({ name: z.string().min(2), strength: z.string().optional(), form: z.string().optional() });
const medicineAssignSchema = z.object({ patientId: z.string(), medicineId: z.string().optional(), medicineName: z.string().min(2).optional(), medicineStrength: z.string().optional(), medicineForm: z.string().optional(), dosage: z.string(), scheduleTimes: z.array(z.string()).default([]), withFood: z.boolean().default(false), instructions: z.string().optional() }).refine((d) => d.medicineId || d.medicineName, { message: 'medicineId or medicineName is required' });
const medicineLogSchema = z.object({ assignmentId: z.string(), patientId: z.string(), status: z.enum(['taken', 'missed', 'delayed']), remarks: z.string().optional() });
const symptomLogSchema = z.object({ patientId: z.string(), type: z.enum(['tremor', 'stiffness', 'pain', 'fatigue', 'balance', 'walking', 'other']), severity: z.number().min(1).max(10), notes: z.string().optional(), occurredAt: z.string().optional() });
const observationSchema = z.object({ patientId: z.string(), mood: z.string().optional(), appetite: z.string().optional(), sleepHours: z.number().optional(), falls: z.boolean().default(false), notes: z.string().optional(), occurredAt: z.string().optional() });

const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
  req.body = parsed.data;
  next();
};

module.exports = { registerSchema, loginSchema, patientSchema, exerciseSchema, exerciseAssignSchema, exerciseLogSchema, medicineSchema, medicineAssignSchema, medicineLogSchema, symptomLogSchema, observationSchema, validate };
