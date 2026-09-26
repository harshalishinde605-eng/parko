import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';

// Skeleton overlay. Assumes the camera preview fills this view (cover) and
// keypoints are normalized 0..1. Front-camera frames should pass mirrored.
// Mapping is approximate if preview/photo aspects differ — the framing guide
// keeps the body centered so error stays small (verify on-device).
const LINKS = [
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
  ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
];

const IDX = {
  nose: 0, leftEye: 1, rightEye: 2, leftEar: 3, rightEar: 4,
  leftShoulder: 5, rightShoulder: 6, leftElbow: 7, rightElbow: 8,
  leftWrist: 9, rightWrist: 10, leftHip: 11, rightHip: 12,
  leftKnee: 13, rightKnee: 14, leftAnkle: 15, rightAnkle: 16,
};

export default function SkeletonOverlay({ keypoints, width, height, mirrored = false, minScore = 0.3 }) {
  if (!keypoints || !width || !height) return <View style={{ width, height }} />;
  const pt = (name) => {
    const kp = keypoints[IDX[name]];
    if (!kp || (kp.score ?? 0) < minScore) return null;
    const x = (mirrored ? 1 - kp.x : kp.x) * width;
    return { x, y: kp.y * height, score: kp.score ?? 0 };
  };
  const pts = {};
  Object.keys(IDX).forEach((n) => { pts[n] = pt(n); });
  const col = (s) => (s >= 0.6 ? '#22c55e' : s >= 0.4 ? '#eab308' : '#ef4444');
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {LINKS.map(([a, b], i) => {
          const p = pts[a], q = pts[b];
          if (!p || !q) return null;
          return <Line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={col(Math.min(p.score, q.score))} strokeWidth={4} strokeLinecap="round" />;
        })}
        {Object.values(pts).map((p, i) => (p ? <Circle key={i} cx={p.x} cy={p.y} r={5} fill={col(p.score)} stroke="#fff" strokeWidth={1.5} /> : null))}
      </Svg>
    </View>
  );
}
