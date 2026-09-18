function pct(n, d) { if (!d) return 0; return Math.round((n / d) * 1000) / 10; }
function exerciseCompletion(logs) {
  const total = logs.length;
  const done = logs.filter((l) => l.status === 'completed').length;
  const partial = logs.filter((l) => l.status === 'partial').length;
  return { total, completed: done, partial, missed: total - done - partial, completionPct: pct(done + partial * 0.5, total) };
}
function medicineAdherence(logs) {
  const total = logs.length;
  const taken = logs.filter((l) => l.status === 'taken').length;
  const delayed = logs.filter((l) => l.status === 'delayed').length;
  return { total, taken, delayed, missed: total - taken - delayed, adherencePct: pct(taken + delayed * 0.5, total) };
}
function symptomTrend(logs) {
  const byType = {};
  for (const l of logs) { (byType[l.type] = byType[l.type] || []).push({ severity: l.severity, at: l.loggedAt }); }
  const avg = {};
  for (const [k, v] of Object.entries(byType)) avg[k] = Math.round((v.reduce((a, b) => a + b.severity, 0) / v.length) * 10) / 10;
  return { byType, avg };
}
module.exports = { pct, exerciseCompletion, medicineAdherence, symptomTrend };
