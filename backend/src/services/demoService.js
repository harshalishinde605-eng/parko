// Exercise capability engine — maps an Exercise row to a demonstration level.
// Level 1 SUPPORTED: fully known exercise (procedural demo + AI monitoring).
// Level 2 COMPOSED: understood primitives, demo composable, monitoring later.
// Level 3 UNSUPPORTED: graceful fallback (instructions + manual logging only).
// Pure functions — unit-testable, no DB. Never invents clinical meaning.
const POSITIONS = ['seated', 'standing', 'lying'];
const JOINTS = ['knee', 'hip', 'shoulder', 'elbow', 'ankle', 'neck'];
const MOVEMENTS = ['extension', 'flexion', 'raise', 'rotation', 'march', 'stand'];
const SIDES = ['left', 'right', 'both'];

const KNOWN = {
  'sit-to-stand': {
    label: 'Sit-to-Stand',
    demo: {
      type: 'procedural-joints',
      joints: ['hip', 'knee'],
      sequence: ['seated', 'rising', 'standing', 'lowering'],
      tempo: 'slow',
    },
    monitoringKey: 'sit-to-stand',
  },
};

function norm(s) {
  return String(s || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
}

function textOf(ex) {
  return `${norm(ex.name)} ${norm(ex.category)} ${norm(ex.description)} ${norm(ex.startingPosition)}`;
}

function findAll(list, text) {
  return list.filter((w) => text.includes(w));
}

function resolveDemo(exercise) {
  const text = textOf(exercise);
  const nameKey = norm(exercise.name).replace(/\s+/g, '-');
  for (const [key, def] of Object.entries(KNOWN)) {
    if (nameKey === key || nameKey.includes(key) || key.includes(nameKey)) {
      return {
        level: 1, status: 'SUPPORTED', label: def.label,
        primitives: [], demo: def.demo, monitoringKey: def.monitoringKey,
        confidence: 1, notes: ['Fully supported: 3D demonstration and AI monitoring available.'],
      };
    }
  }
  const positions = findAll(POSITIONS, text);
  const joints = findAll(JOINTS, text);
  const movements = findAll(MOVEMENTS, text);
  const sides = findAll(SIDES, text);
  if (positions.length && joints.length && movements.length) {
    return {
      level: 2, status: 'COMPOSED', label: exercise.name,
      primitives: [...positions.map((p) => ({ kind: 'position', value: p })),
        ...joints.flatMap((j) => movements.map((m) => ({ kind: 'movement', joint: j, action: m }))),
        ...sides.map((s) => ({ kind: 'side', value: s }))],
      demo: { type: 'procedural-joints', joints, sequence: ['start', 'move', 'hold', 'return'], tempo: norm(exercise.tempo) || 'slow' },
      monitoringKey: null,
      confidence: 0.7,
      notes: ['3D demonstration can be composed from understood primitives.', 'AI monitoring is not available for this exercise yet.'],
    };
  }
  const missing = [];
  if (!positions.length) missing.push('starting position');
  if (!joints.length) missing.push('joint');
  if (!movements.length) missing.push('movement');
  return {
    level: 3, status: 'UNSUPPORTED', label: exercise.name,
    primitives: [], demo: null, monitoringKey: null, confidence: 0,
    notes: [`Not currently understood (${missing.join(', ')} unclear). Written instructions and manual logging remain available.`],
  };
}

module.exports = { resolveDemo, KNOWN, POSITIONS, JOINTS, MOVEMENTS, SIDES };
