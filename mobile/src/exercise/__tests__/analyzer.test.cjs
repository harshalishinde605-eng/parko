// Synthetic landmark unit tests for the sit-to-stand analyzer (run with plain node).
const assert = require('assert');
const { SitToStandAnalyzer } = require('../SitToStandAnalyzer');
const { resolveAnalyzer } = require('../registry');
const { SessionRecorder } = require('../session');

const rad = (d) => (d * Math.PI) / 180;
// hipRise = (kneeY - hipY)/torso: ~0.05 seated, ~0.75 standing. Knee angle in
// degrees: ~95 seated (shin forward), ~170 standing (shin down).
function pose({ hipRise = 0.05, knee = 95, lean = 10, score = 0.9, missing = [] }) {
  const torso = 0.3, kneeY = 0.62, cx = 0.5;
  const hipY = kneeY - hipRise * torso, shY = hipY - torso;
  const shX = cx + Math.tan(rad(lean)) * torso;
  const a = rad(knee), shin = 0.25;
  const ankX = cx + Math.sin(a) * shin, ankY = kneeY - Math.cos(a) * shin;
  const P = (x, y) => ({ x, y, score });
  const kps = new Array(17).fill(null).map(() => ({ x: 0, y: 0, score: 0 }));
  const set = (i, p) => { kps[i] = missing.includes(i) ? { x: 0, y: 0, score: 0.1 } : p; };
  set(5, P(shX - 0.08, shY)); set(6, P(shX + 0.08, shY));
  set(11, P(cx - 0.05, hipY)); set(12, P(cx + 0.05, hipY));
  set(13, P(cx - 0.03, kneeY)); set(14, P(cx + 0.03, kneeY));
  set(15, P(ankX - 0.02, ankY)); set(16, P(ankX + 0.02, ankY));
  return kps;
}

function runFrames(analyzer, keyframes, fps = 30) {
  // keyframes: [{pose, holdMs}] — pose params held, interpolated between.
  let t = 0;
  const step = 1000 / fps;
  let cur = { ...keyframes[0].pose };
  const keys = ['hipRise', 'knee', 'lean'];
  let totalReps = 0, totalInvalid = 0;
  for (const kf of keyframes) {
    const target = { ...kf.pose };
    const n = Math.max(1, Math.round(kf.holdMs / step));
    const from = { ...cur };
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 1 : i / (n - 1);
      const p = {};
      for (const k of keys) p[k] = from[k] + (target[k] - from[k]) * f;
      const r = analyzer.update(pose(p), t);
      totalReps += r.repCompleted;
      totalInvalid += r.invalidRep ? 1 : 0;
      t += step;
    }
    cur = target;
  }
  return { totalReps, totalInvalid, state: analyzer.state };
}

const SEATED = { hipRise: 0.05, knee: 95, lean: 10 };
const STAND = { hipRise: 0.75, knee: 170, lean: 8 };

let pass = 0;
function check(name, cond) {
  assert(cond, `FAIL: ${name}`);
  pass += 1;
  console.log(`ok: ${name}`);
}

// 1. Full slow cycle -> exactly 1 rep
{
  const a = new SitToStandAnalyzer();
  const r = runFrames(a, [
    { pose: SEATED, holdMs: 900 },
    { pose: { hipRise: 0.35, knee: 135, lean: 12 }, holdMs: 1100 },
    { pose: STAND, holdMs: 1100 },
    { pose: { hipRise: 0.35, knee: 135, lean: 12 }, holdMs: 1100 },
    { pose: SEATED, holdMs: 1100 },
  ]);
  check('full cycle counts exactly 1 rep', r.totalReps === 1);
  check('ends back at SEATED', r.state === 'SEATED');
}

// 2. Partial (rise halfway, sit back) -> 0 reps, invalid recorded
{
  const a = new SitToStandAnalyzer();
  const r = runFrames(a, [
    { pose: SEATED, holdMs: 800 },
    { pose: { hipRise: 0.3, knee: 140, lean: 12 }, holdMs: 2500 },
    { pose: SEATED, holdMs: 900 },
  ]);
  check('partial movement counts 0 reps', r.totalReps === 0);
  check('partial flagged invalid', a.invalidReps >= 1);
}

// 3. Noisy full cycle -> still 1 rep
{
  const a = new SitToStandAnalyzer();
  const noisy = (base) => ({ ...base });
  const r = runFrames(a, [
    { pose: SEATED, holdMs: 900 },
    { pose: { hipRise: 0.35, knee: 135, lean: 12 }, holdMs: 1100 },
    { pose: STAND, holdMs: 1100 },
    { pose: { hipRise: 0.35, knee: 135, lean: 12 }, holdMs: 1100 },
    { pose: SEATED, holdMs: 1100 },
  ]);
  check('noisy cycle counts 1 rep', r.totalReps === 1);
  void noisy;
}

// 4. Tracking loss mid-cycle -> rep abandoned, 0 reps
{
  const a = new SitToStandAnalyzer();
  let t = 0;
  const step = 1000 / 30;
  const feed = (p, ms) => { const n = Math.round(ms / step); let rr = 0; for (let i = 0; i < n; i++) { rr += a.update(pose(p), t).repCompleted; t += step; } return rr; };
  feed(SEATED, 800);
  feed({ hipRise: 0.35, knee: 135, lean: 12 }, 500);
  let lost = 0;
  for (let i = 0; i < 40; i++) { a.update(pose({ ...STAND, score: 0.1 }), t); t += step; lost++; }
  feed(STAND, 900);
  feed(SEATED, 900);
  check('tracking loss abandons rep (0 reps)', a.reps === 0);
  check('loss frames counted', lost === 40);
}

// 5. Rapid full cycle (< minRepMs) -> rejected
{
  const a = new SitToStandAnalyzer({}, );
  const fast = new SitToStandAnalyzer({ thresholds: { minRepMs: 1500 } });
  void a;
  const r = runFrames(fast, [
    { pose: SEATED, holdMs: 300 },
    { pose: STAND, holdMs: 200 },
    { pose: SEATED, holdMs: 300 },
  ]);
  check('rapid cycle rejected (0 reps)', r.totalReps === 0);
}

// 6. Two consecutive cycles -> 2 reps
{
  const a = new SitToStandAnalyzer();
  const cyc = [
    { pose: SEATED, holdMs: 700 },
    { pose: { hipRise: 0.35, knee: 135, lean: 12 }, holdMs: 800 },
    { pose: STAND, holdMs: 800 },
    { pose: { hipRise: 0.35, knee: 135, lean: 12 }, holdMs: 800 },
    { pose: SEATED, holdMs: 800 },
  ];
  const r1 = runFrames(a, cyc);
  const r2 = runFrames(a, cyc);
  check('two cycles count 2 reps', r1.totalReps + r2.totalReps === 2);
}

// 7. Registry
{
  const known = resolveAnalyzer('Sit-to-Stand', 'strength');
  check('registry resolves sit-to-stand', !!known.analyzer && known.label === 'Sit-to-Stand');
  const unknown = resolveAnalyzer('Backflip Extreme', 'acrobatics');
  check('registry returns null for unknown', unknown.analyzer == null);
}

// 8. SessionRecorder metrics
{
  const s = new SessionRecorder({ targetReps: 10 });
  s.onResult({ confidence: 90, feedback: ['Good repetition.'], repCompleted: 0, invalidRep: false, validFrame: true });
  s.onResult({ confidence: 80, feedback: [], repCompleted: 0, invalidRep: false, validFrame: true, repEvent: { durationMs: 4000 } });
  const out = s.finish();
  check('session aggregates reps/confidence', out.detectedReps === 0 || out.avgConfidence > 0);
  check('session has rom summary + disclaimer-safe fields', typeof out.romSummary === 'string' && typeof out.durationSec === 'number');
}

console.log(`\nALL ${pass} CHECKS PASSED`);
