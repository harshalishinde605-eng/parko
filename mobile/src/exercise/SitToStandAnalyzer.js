// SitToStandAnalyzer — SEATED -> RISING -> STANDING -> LOWERING -> REP.
// Pure JS. Thresholds are DEFAULTS documented for on-device tuning with a
// real person; they must be validated before any accuracy claim.
const { BaseAnalyzer } = require('./BaseAnalyzer');
const L = require('./landmarks');

const DEFAULTS = {
  // hipRise = (kneeY - hipY) / torsoLen, y grows downward, so hipRise is
  // positive when standing (hip above knee) and ~zero when seated.
  seatedHipRiseMax: 0.18,
  standHipRiseMin: 0.5,
  seatedKneeMax: 122, // knee angle deg
  standKneeMin: 158,
  trunkUprightMax: 22, // deg lean allowed while standing
  kneeAsymWarn: 25, // L/R knee angle difference deg
  minDwellMs: 350,
  minRepMs: 1500,
  maxRepMs: 20000,
  fastRepMs: 2200, // below this: "move a little slower" observation
};

class SitToStandAnalyzer extends BaseAnalyzer {
  static exerciseKeys = ['sit-to-stand', 'sit to stand', 'sit_to_stand', 'chair stand', 'sit stand'];

  constructor(config = {}) {
    super({
      minVisibility: 0.5,
      requiredJoints: ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'],
      smoothJoints: ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'],
      minDwellMs: 350,
      lossTimeoutMs: 800,
      ...config,
      thresholds: { ...DEFAULTS, ...(config.thresholds || {}) },
    });
    this.maxKneeExt = 0; // per-rep range-of-motion tracking
    this.maxHipRise = -Infinity;
  }

  initialState() { return 'SEATED'; }

  requiredLandmarks() {
    return ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'];
  }

  extractFeatures(points) {
    // Rebuild MoveNet-ordered array from named smoothed points.
    const order = ['nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar', 'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'];
    const kps = order.map((n) => (points[n] ? { x: points[n].x, y: points[n].y, score: 1 } : { x: 0, y: 0, score: 0 }));
    const T = this.config.thresholds;
    const torso = L.torsoLength(kps, 0);
    if (!torso || torso < 1e-6) return null;
    const hip = L.mid(L.getPoint(kps, 'leftHip'), L.getPoint(kps, 'rightHip'));
    const knee = L.mid(L.getPoint(kps, 'leftKnee'), L.getPoint(kps, 'rightKnee'));
    const { avg: kneeAngle, asym } = L.avgKneeAngle(kps, 0);
    const lean = L.trunkLeanDeg(kps, 0);
    if (!hip || !knee || kneeAngle == null) return null;
    return {
      hipRise: (knee.y - hip.y) / torso,
      kneeAngle,
      kneeAsym: asym,
      trunkLean: lean,
      T,
    };
  }

  step(f, nowMs) {
    const T = f.T;
    const inState = (ms) => this.inStateFor(nowMs, ms);
    if (this.repStartMs == null && this.state !== 'SEATED') {
      // rep timing starts when leaving seated
    }
    switch (this.state) {
      case 'SEATED':
        if (f.hipRise > T.seatedHipRiseMax + 0.06 || f.kneeAngle > T.seatedKneeMax + 8) {
          this.goto('RISING', nowMs);
          this.repStartMs = nowMs;
          this.maxKneeExt = f.kneeAngle;
          this.maxHipRise = f.hipRise;
        }
        break;
      case 'RISING':
        this.maxKneeExt = Math.max(this.maxKneeExt, f.kneeAngle);
        if (f.hipRise >= T.standHipRiseMin && f.kneeAngle >= T.standKneeMin && inState(T.minDwellMs)) {
          this.goto('STANDING', nowMs);
          if (f.trunkLean != null && f.trunkLean > 25) this.feedback.push('Try to stand fully upright.');
        } else if ((f.hipRise <= T.seatedHipRiseMax && f.kneeAngle <= T.seatedKneeMax && inState(T.minDwellMs)) || (this.repStartMs != null && nowMs - this.repStartMs > T.maxRepMs)) {
          this.rejectRep('Incomplete movement — stand fully before sitting.');
          this.resetCycle();
        }
        break;
      case 'STANDING':
        this.maxKneeExt = Math.max(this.maxKneeExt, f.kneeAngle);
        if (f.kneeAsym != null && f.kneeAsym > T.kneeAsymWarn) this.feedback.push('Keep your knees aligned.');
        if (f.hipRise < T.standHipRiseMin - 0.06 && inState(T.minDwellMs)) {
          this.goto('LOWERING', nowMs);
        } else if (this.repStartMs != null && nowMs - this.repStartMs > T.maxRepMs) {
          this.rejectRep('Movement took too long — counted as incomplete.');
          this.resetCycle();
        }
        break;
      case 'LOWERING':
        if (f.hipRise <= T.seatedHipRiseMax && f.kneeAngle <= T.seatedKneeMax && inState(T.minDwellMs)) {
          const dur = this.repStartMs != null ? nowMs - this.repStartMs : null;
          if (dur != null && dur < T.minRepMs) {
            this.rejectRep('Movement was too quick to count reliably.');
            this.resetCycle();
          } else {
            if (dur != null && dur < T.fastRepMs) this.feedback.push('Move a little slower for steadier repetitions.');
            this.completeRep(nowMs, { maxKneeExtension: Math.round(this.maxKneeExt), maxHipRise: Math.round(this.maxHipRise * 100) / 100 });
            this.feedback.push('Good repetition.');
          }
        } else if (this.repStartMs != null && nowMs - this.repStartMs > T.maxRepMs) {
          this.rejectRep('Incomplete movement — return fully to seated.');
          this.resetCycle();
        }
        break;
      default:
        this.resetCycle();
    }
    if (this.repStartMs == null && (this.state === 'RISING' || this.state === 'STANDING' || this.state === 'LOWERING')) {
      this.repStartMs = nowMs;
    }
    if (f.hipRise > this.maxHipRise) this.maxHipRise = f.hipRise;
  }
}

module.exports = { SitToStandAnalyzer, SIT_TO_STAND_DEFAULTS: DEFAULTS };
