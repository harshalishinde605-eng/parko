// SessionRecorder — aggregates analyzer events into a session result (pure JS).
class SessionRecorder {
  constructor({ targetReps = 10, assignmentId = null } = {}) {
    this.targetReps = targetReps;
    this.assignmentId = assignmentId;
    this.startedAt = Date.now();
    this.repDurations = [];
    this.maxExtensions = [];
    this.invalidCount = 0;
    this.feedbackTally = {};
    this.confidences = [];
    this.frames = 0;
    this.lowConfNote = 0;
  }

  onResult(r) {
    this.frames += 1;
    if (typeof r.confidence === 'number') this.confidences.push(r.confidence);
    for (const f of r.feedback || []) this.feedbackTally[f] = (this.feedbackTally[f] || 0) + 1;
    if (r.repEvent) {
      if (typeof r.repEvent.durationMs === 'number') this.repDurations.push(r.repEvent.durationMs);
      if (typeof r.repEvent.maxKneeExtension === 'number') this.maxExtensions.push(r.repEvent.maxKneeExtension);
    }
    if (r.invalidRep) this.invalidCount += 1;
    if (!r.validFrame) this.lowConfNote += 1;
  }

  finish() {
    const endedAt = Date.now();
    const durationSec = Math.round((endedAt - this.startedAt) / 1000);
    const avgConfidence = this.confidences.length
      ? Math.round((this.confidences.reduce((a, b) => a + b, 0) / this.confidences.length) * 10) / 10
      : 0;
    let consistencyPct = 0;
    if (this.repDurations.length >= 2) {
      const mean = this.repDurations.reduce((a, b) => a + b, 0) / this.repDurations.length;
      const variance = this.repDurations.reduce((a, b) => a + (b - mean) ** 2, 0) / this.repDurations.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      consistencyPct = Math.max(0, Math.min(100, Math.round(100 / (1 + 2 * cv))));
    } else if (this.repDurations.length === 1) {
      consistencyPct = 100;
    }
    const topFeedback = Object.entries(this.feedbackTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([text, count]) => (count > 1 ? `${text} (${count}×)` : text));
    const rom = this.maxExtensions.length
      ? `Max knee extension observed ${Math.round(Math.max(...this.maxExtensions))} degrees across ${this.maxExtensions.length} detected repetition(s).`
      : 'Range-of-motion observations unavailable for this session.';
    return {
      detectedReps: this.repDurations.length,
      invalidAttempts: this.invalidCount,
      targetReps: this.targetReps,
      durationSec,
      avgConfidence,
      consistencyPct,
      romSummary: rom,
      formNotes: topFeedback,
      lowVisibilityFrames: this.lowConfNote,
      totalFrames: this.frames,
      startedAt: new Date(this.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
    };
  }
}

module.exports = { SessionRecorder };
