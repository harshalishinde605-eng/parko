// AI Care Snapshot service.
//
// STEP 1 (always): collect STRUCTURED recorded data — never raw DB dumps.
// STEP 2: render via template engine (works today, deterministic).
// STEP 3 (optional): if AI_API_URL + AI_API_KEY are configured, ask an
//   OpenAI-compatible chat model to phrase it; ANY failure falls back
//   to the template. The LLM never decides urgency — rules do that.
//
// Medical-safety: output is descriptive ("was recorded"), never diagnostic.
const crypto = require('crypto');
const { buildInsights } = require('../utils/insights');
const { logger } = require('../utils/logger');

const DISCLAIMER = 'AI-generated from recorded data — review before use.';

const SYSTEM_PROMPT = `You are an AI documentation assistant for a Parkinson's care-management application.

Summarize recorded patient-care information for a healthcare professional.

Never diagnose.
Never predict disease progression.
Never recommend medication changes.
Never invent missing information.
Never infer causation.

Use phrases such as:
recorded,
reported,
documented,
observed.

Clearly distinguish patient-reported information,
caregiver observations, medication records,
exercise records and AI-assisted exercise measurements.

Return a concise factual summary.`;

function collectStructured(patient, ins, days) {
  const s = ins.stats;
  const byType = {};
  // symptom counts are derived from averages keys + day bars to avoid extra queries
  const tremor = (ins.dayBars?.tremor || []).reduce((a, b) => a + b.count, 0);
  const walking = (ins.dayBars?.walking || []).reduce((a, b) => a + b.count, 0);
  return {
    patient: patient.fullName,
    period: { days, from: new Date(Date.now() - days * 864e5).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
    medication: { recorded: s.meds.total, recordedTaken: s.meds.taken, rate: s.meds.adherencePct },
    exercise: { recorded: s.exercise.total, completed: s.exercise.completed, rate: s.exercise.completionPct },
    checkIns: { expected: days, completed: s.checkins },
    symptoms: { tremor, walkingDifficulty: walking },
    falls: s.falls,
    caregiverObservations: (ins.summary?.paragraphs || []).filter((p) => p.startsWith('Latest caregiver note')).slice(0, 3),
    notableChanges: (ins.changes || []).filter((c) => c.delta !== 0).map((c) => c.text),
    _keys: byType,
  };
}

function sourceHash(structured) {
  return crypto.createHash('sha256').update(JSON.stringify(structured)).digest('hex');
}

function renderTemplate(structured, paragraphs) {
  const lines = [
    `Care snapshot for ${structured.patient} (${structured.period.from} to ${structured.period.to}).`,
    ...paragraphs,
  ];
  return lines.join('\n');
}

async function tryLlm(structured) {
  const url = process.env.AI_API_URL;
  const key = process.env.AI_API_KEY;
  if (!url || !key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Patient data:\n${JSON.stringify(structured)}` },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`AI provider ${res.status}`);
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    logger.error('snapshot LLM failed, using template', { error: e.message });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function generateSnapshot(prisma, { patientId, doctorId, days = 7 }) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
  if (!patient) { const e = new Error('Patient not found'); e.status = 404; throw e; }
  const ins = await buildInsights(prisma, patientId, days);
  const structured = collectStructured(patient, ins, days);
  const hash = sourceHash(structured);
  const periodStart = new Date(Date.now() - days * 864e5);

  const cached = await prisma.aiCareSummary.findFirst({
    where: { patientId, periodStart: { gte: new Date(periodStart.getTime() - 36e5) }, sourceHash: hash },
    orderBy: { createdAt: 'desc' },
  });
  if (cached) {
    return { paragraphs: cached.summaryText.split('\n'), engine: cached.engine, cached: true, structured, disclaimer: DISCLAIMER };
  }

  let text = await tryLlm(structured);
  let engine = 'llm';
  if (!text) {
    text = renderTemplate(structured, ins.summary.paragraphs);
    engine = 'template';
  }
  await prisma.aiCareSummary.create({
    data: { patientId, doctorId, periodStart, periodEnd: new Date(), sourceHash: hash, summaryText: text, engine },
  });
  return { paragraphs: text.split('\n'), engine, cached: false, structured, disclaimer: DISCLAIMER };
}

module.exports = { generateSnapshot, collectStructured, sourceHash, SYSTEM_PROMPT, DISCLAIMER };
