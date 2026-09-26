// BaseAnalyzer — shared frame pipeline for all exercise analyzers (pure JS).
// Flow per frame: validate -> smooth -> extractFeatures -> updateStateMachine
// Returns: { state, repCompleted, invalidRep, confidence, feedback[], validFrame }
const { JointSmoother } = require('./smooth');

class BaseAnalyzer {
  constructor(config = {}) {
    this.config = {
      minVisibility: 0.5,
      requiredJoints: [],
      minDwellMs: 300,
      lossTimeoutMs: 800,
      ...config,
    };
    this.smoother = new JointSmoother(this.config.smoothJoints || this.config.requiredJoints, {
      freq: 30, minCutoff: 1.7, beta: 0.015, ...(config.smoother || {}),
    });
    this.reset();
  }

  reset() {
    this.state = this.initialState();
    this.stateSince = null;
    this.reps = 0;
    this.invalidReps = 0;
    this.frames = 0;
    this.validFrames = 0;
    this.lowConfFrames = 0;
    this.consecutiveInvalid = 0;
    this.feedback = [];
    this.repStartMs = null;
    this.visited = new Set();
    this.smoother.reset();
    this.onReset();
  }

  initialState() { return 'IDLE'; }
  onReset() {}
  requiredLandmarks() { return this.config.requiredJoints; }
  // Subclass: features from smoothed named points -> object or null.
  extractFeatures(_points) { return {}; }
  // Subclass: state machine step. May call this.completeRep(nowMs) / this.rejectRep(reason).
  step(_features, _nowMs) {}

  validatePose(keypoints) {
    const missing = [];
    for (const j of this.requiredLandmarks()) {
      const kp = keypoints[__KP_INDEX[j]];
      if (!kp || (kp.score ?? 0) < this.config.minVisibility) missing.push(j);
    }
    return { ok: missing.length === 0, missing };
  }

  namedPoints(keypoints) {
    const out = {};
    for (const j of this.config.smoothJoints || this.config.requiredJoints) {
      const kp = keypoints[__KP_INDEX[j]];
      if (kp) out[j] = { x: kp.x, y: kp.y, score: kp.score ?? 0 };
    }
    return out;
  }

  update(keypoints, nowMs) {
    this.frames += 1;
    this.feedback = [];
    this._repEvent = null;
    this._invalidEvent = false;
    const check = this.validatePose(keypoints);
    if (!check.ok) {
      this.consecutiveInvalid += 1;
      this.lowConfFrames += 1;
      if (this.state !== this.initialState() && this.consecutiveInvalid * 33 > this.config.lossTimeoutMs) {
        // Tracking lost mid-rep: abandon cycle, do NOT count.
        this.rejectRep('Landmark tracking was lost during the movement.');
        this.resetCycle();
      }
      return this.result(false, nowMs);
    }
    this.consecutiveInvalid = 0;
    this.validFrames += 1;
    const smoothed = this.smoother.update(this.namedPoints(keypoints), nowMs);
    const features = this.extractFeatures(smoothed);
    if (features) this.step(features, nowMs);
    return this.result(true, nowMs);
  }

  inStateFor(nowMs, ms) {
    return this.stateSince != null && nowMs - this.stateSince >= ms;
  }

  goto(state, nowMs) {
    if (this.state !== state) {
      this.state = state;
      this.stateSince = nowMs;
      this.visited.add(state);
    }
  }

  resetCycle() {
    this.visited = new Set([this.initialState()]);
    this.state = this.initialState();
    this.stateSince = null;
    this.repStartMs = null;
  }

  completeRep(nowMs, extra = {}) {
    this.reps += 1;
    const started = this.repStartMs;
    this._repEvent = { completed: true, repNumber: this.reps, durationMs: started != null ? nowMs - started : null, ...extra };
    this.resetCycle();
  }

  rejectRep(reason) {
    this.invalidReps += 1;
    this._invalidEvent = true;
    if (reason) this.feedback.push(reason);
  }

  confidence() {
    if (this.frames === 0) return 0;
    return Math.round((this.validFrames / this.frames) * 1000) / 10;
  }

  result(validFrame, _nowMs) {
    const ev = this._repEvent;
    this._repEvent = null;
    const inv = this._invalidEvent;
    this._invalidEvent = false;
    return {
      state: this.state,
      repCompleted: ev ? 1 : 0,
      repEvent: ev,
      invalidRep: inv,
      confidence: this.confidence(),
      feedback: [...this.feedback],
      validFrame,
      reps: this.reps,
      invalidReps: this.invalidReps,
    };
  }
}

// MoveNet index map shared with analyzers (avoids circular imports).
const __KP_INDEX = {
  nose: 0, leftEye: 1, rightEye: 2, leftEar: 3, rightEar: 4,
  leftShoulder: 5, rightShoulder: 6, leftElbow: 7, rightElbow: 8,
  leftWrist: 9, rightWrist: 10, leftHip: 11, rightHip: 12,
  leftKnee: 13, rightKnee: 14, leftAnkle: 15, rightAnkle: 16,
};

module.exports = { BaseAnalyzer, KP_INDEX: __KP_INDEX };
