// MoveNet (17 keypoints) geometry helpers — pure JS, no RN dependencies.
// Image coordinates: x right, y DOWN, normalized 0..1.
const KP = {
  nose: 0, leftEye: 1, rightEye: 2, leftEar: 3, rightEar: 4,
  leftShoulder: 5, rightShoulder: 6, leftElbow: 7, rightElbow: 8,
  leftWrist: 9, rightWrist: 10, leftHip: 11, rightHip: 12,
  leftKnee: 13, rightKnee: 14, leftAnkle: 15, rightAnkle: 16,
};

function getPoint(keypoints, name, minScore = 0) {
  const kp = keypoints[KP[name]];
  if (!kp || (kp.score ?? 0) < minScore) return null;
  return { x: kp.x, y: kp.y, score: kp.score ?? 0 };
}

function mid(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, score: Math.min(a.score, b.score) };
}

function dist(a, b) {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Angle in degrees at vertex b formed by a-b-c.
function angleDeg(a, b, c) {
  if (!a || !b || !c) return null;
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y);
  if (m1 < 1e-6 || m2 < 1e-6) return null;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Torso length (shoulder-center to hip-center) — the normalization ruler.
function torsoLength(kps, minScore = 0) {
  const sh = mid(getPoint(kps, 'leftShoulder', minScore), getPoint(kps, 'rightShoulder', minScore));
  const hip = mid(getPoint(kps, 'leftHip', minScore), getPoint(kps, 'rightHip', minScore));
  return dist(sh, hip);
}

// Trunk lean vs vertical in degrees (0 = upright).
function trunkLeanDeg(kps, minScore = 0) {
  const sh = mid(getPoint(kps, 'leftShoulder', minScore), getPoint(kps, 'rightShoulder', minScore));
  const hip = mid(getPoint(kps, 'leftHip', minScore), getPoint(kps, 'rightHip', minScore));
  if (!sh || !hip) return null;
  const dx = sh.x - hip.x, dy = hip.y - sh.y; // up is positive
  const m = Math.hypot(dx, dy);
  if (m < 1e-6) return null;
  return (Math.acos(Math.max(-1, Math.min(1, dy / m))) * 180) / Math.PI;
}

function avgKneeAngle(kps, minScore = 0) {
  const l = angleDeg(getPoint(kps, 'leftHip', minScore), getPoint(kps, 'leftKnee', minScore), getPoint(kps, 'leftAnkle', minScore));
  const r = angleDeg(getPoint(kps, 'rightHip', minScore), getPoint(kps, 'rightKnee', minScore), getPoint(kps, 'rightAnkle', minScore));
  if (l == null && r == null) return { avg: null, asym: null };
  const vals = [l, r].filter((v) => v != null);
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, asym: l != null && r != null ? Math.abs(l - r) : null };
}

module.exports = { KP, getPoint, mid, dist, angleDeg, torsoLength, trunkLeanDeg, avgKneeAngle };
