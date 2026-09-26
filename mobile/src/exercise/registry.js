// Analyzer registry — maps exercise names/categories to analyzer classes.
// New exercises plug in here without touching the session pipeline.
const { SitToStandAnalyzer } = require('./SitToStandAnalyzer');

const ENTRIES = [
  { keys: SitToStandAnalyzer.exerciseKeys, create: (config) => new SitToStandAnalyzer(config), label: 'Sit-to-Stand' },
];

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
}

function resolveAnalyzer(exerciseName, category, config) {
  const hay = `${normalize(exerciseName)} ${normalize(category)}`;
  for (const e of ENTRIES) {
    if (e.keys.some((k) => hay.includes(normalize(k)))) return { analyzer: e.create(config), label: e.label };
  }
  return { analyzer: null, label: null };
}

module.exports = { resolveAnalyzer, ENTRIES };
