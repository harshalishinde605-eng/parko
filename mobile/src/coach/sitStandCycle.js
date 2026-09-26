// Procedural sit-to-stand joint cycle — mirrors the analyzer state machine
// (SEATED -> RISING -> STANDING -> LOWERING) so demo and monitoring agree.
// Angles in degrees; SIGN flips rotation direction if the rig is mirrored
// (to be confirmed on first device test — one constant, no logic change).
// Pure JS, unit-tested.
const SIGN = 1;

const TEMPO = {
  slow: { seated: 2000, rise: 2200, stand: 1500, lower: 2200 },
  moderate: { seated: 1200, rise: 1400, stand: 1000, lower: 1400 },
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

// phaseAt: position inside the repeating cycle at elapsed ms.
function phaseAt(elapsedMs, tempo = 'slow') {
  const T = TEMPO[tempo] || TEMPO.slow;
  const total = T.seated + T.rise + T.stand + T.lower;
  const t = ((elapsedMs % total) + total) % total;
  if (t < T.seated) return { phase: 'seated', k: 0 };
  if (t < T.seated + T.rise) return { phase: 'rising', k: ease((t - T.seated) / T.rise) };
  if (t < T.seated + T.rise + T.stand) return { phase: 'standing', k: 1 };
  return { phase: 'lowering', k: 1 - ease((t - T.seated - T.rise - T.stand) / T.lower) };
}

// Joint angles (deg) for a cycle position k: 0 = seated, 1 = standing.
function anglesAt(k) {
  return {
    thighDeg: SIGN * lerp(-88, 0, k),
    shinDeg: SIGN * lerp(88, 4, k),
    spineDeg: SIGN * lerp(12, 0, k),
  };
}

function cycleAt(elapsedMs, tempo) {
  const { phase, k } = phaseAt(elapsedMs, tempo);
  return { phase, k, angles: anglesAt(k) };
}

module.exports = { phaseAt, anglesAt, cycleAt, TEMPO, SIGN };
