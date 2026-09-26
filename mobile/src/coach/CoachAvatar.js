import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three-stdlib';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { matchBones, requiredForSitStand } from './modelUtil';
import { cycleAt } from './sitStandCycle';

const rad = (d) => (d * Math.PI) / 180;

function b64ToArrayBuffer(b64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = new Uint8Array((clean.length * 3) / 4);
  let p = 0, i = 0;
  while (i < clean.length) {
    const e1 = chars.indexOf(clean[i++]); const e2 = chars.indexOf(clean[i++]);
    const e3 = chars.indexOf(clean[i++]); const e4 = chars.indexOf(clean[i++]);
    const b1 = (e1 << 2) | (e2 >> 4);
    const b2 = ((e2 & 15) << 4) | (e3 >> 2);
    const b3 = ((e3 & 3) << 6) | e4;
    bytes[p++] = b1; if (e3 !== 64) bytes[p++] = b2; if (e4 !== 64) bytes[p++] = b3;
  }
  return bytes.buffer.slice(0, p);
}

// Highest ancestor below the scene (model subtree root).
function subtreeRoot(scene, node) {
  let cur = node;
  let parent = null;
  const findParent = (root, target) => {
    let found = null;
    root.traverse((o) => {
      if (found) return;
      if ((o.children || []).includes(target)) found = o;
    });
    return found;
  };
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const p = findParent(scene, cur);
    if (!p || p === scene) return cur;
    parent = cur;
    cur = p;
  }
}

function parentMap(scene) {
  const map = new Map();
  scene.traverse((o) => {
    for (const c of o.children || []) map.set(c, o);
  });
  return map;
}

function ancestors(pmap, node) {
  const out = [];
  let cur = pmap.get(node);
  let guard = 0;
  while (cur && guard++ < 20) {
    out.push(cur);
    cur = pmap.get(cur);
  }
  return out;
}

function pickRiggedMesh(scene, gender) {
  const wantFemale = /female|woman|girl|lady/i.test(gender || '');
  const pmap = parentMap(scene);
  const rigged = [];
  scene.traverse((o) => {
    if (o && o.isSkinnedMesh) rigged.push(o);
  });
  const line = (o) => {
    const names = [o.name];
    let cur = pmap.get(o);
    let guard = 0;
    while (cur && guard++ < 12) { names.push(cur.name); cur = pmap.get(cur); }
    return names.join(' ');
  };
  const match = rigged.filter((o) => {
    const s = line(o);
    if (/woman|female|girl|lady/i.test(s)) return wantFemale;
    if (/man\s*\(rig\)/i.test(s)) return !wantFemale;
    return !wantFemale;
  });
  return { selected: match[0] || rigged[0] || null, rigged };
}

function matchBonesIn(list) {
  const found = {};
  const seen = {};
  for (const o of list || []) {
    if (!o || !o.name) continue;
    for (const [key, re] of Object.entries(BONE_PATTERNS)) {
      if (!seen[key] && re.test(o.name)) {
        seen[key] = true;
        found[key] = o;
      }
    }
  }
  return found;
}

function RiggedFigure({ scene, gender, theme, playing, tempo, replayKey, onBones }) {
  const restRef = useRef({});
  const clockRef = useRef(0);

  const prepared = useMemo(() => {
    const found = pickRiggedMesh(scene, gender);
    const selected = found.selected;
    const rigged = found.rigged;
    // Show ONLY the selected rigged mesh; hide every other mesh node
    // (the file also ships static display meshes that must never render).
    const shown = [];
    scene.traverse((o) => {
      if (o && o.isMesh) {
        const show = selected && o === selected;
        o.visible = !!show;
        if (show) shown.push(o.name || 'mesh');
      }
    });
    // Animate the SELECTED mesh's own skeleton: rig joints live outside the
    // mesh's ancestor chain, so subtree search misses them (silent no-motion).
    const skelBones = (selected && selected.skeleton && selected.skeleton.bones) || [];
    const scoped = skelBones.length ? matchBonesIn(skelBones) : {};
    const bones = Object.keys(scoped).length ? scoped : matchBones(scene);
    // Capture rest pose ONCE per bone (never re-capture a posed skeleton).
    Object.values(bones).forEach((bn) => {
      if (!restRef.current[bn.name]) restRef.current[bn.name] = bn.quaternion.clone();
    });
    // Outfit theme on the visible mesh only.
    const shirt = [];
    if (selected) {
      selected.material = Array.isArray(selected.material)
        ? selected.material.map((m) => m.clone())
        : selected.material.clone();
      (Array.isArray(selected.material) ? selected.material : [selected.material]).forEach((m) => {
        if (m && m.color) m.color.set(theme.primary);
      });
      shirt.push(selected.name || 'mesh');
    }
    return { bones, shirt, riggedCount: rigged.length, shown };
  }, [scene, gender, theme.primary]);

  useEffect(() => {
    const req = requiredForSitStand(prepared.bones);
    onBones && onBones({ ok: req.ok, missing: req.missing, shirtMeshes: prepared.shirt, riggedMeshes: prepared.riggedCount, shown: prepared.shown });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  useFrame((_, delta) => {
    const { bones } = prepared;
    if (!playing) return;
    clockRef.current += delta * 1000;
    const { angles } = cycleAt(clockRef.current, tempo);
    const apply = (bn, deg) => {
      if (!bn) return;
      const rest = restRef.current[bn.name];
      if (!rest) return;
      bn.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(deg), 0, 0)));
    };
    apply(bones.thighL, angles.thighDeg);
    apply(bones.thighR, angles.thighDeg);
    apply(bones.shinL, -angles.thighDeg);
    apply(bones.shinR, -angles.thighDeg);
    if (bones.spine) apply(bones.spine, angles.spineDeg);
  });

  useEffect(() => {
    clockRef.current = 0;
  }, [replayKey]);

  return <primitive object={scene} />;
}

export default function CoachAvatar({ gender, theme, playing, tempo = 'slow', replayKey = 0, onStatus, onBones }) {
  const [scene, setScene] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        onStatus && onStatus('Loading 3D coach…');
        const asset = Asset.fromModule(require('../../assets/coach.glb'));
        await asset.downloadAsync();
        const uri = asset.localUri || asset.uri;
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const parsed = await new GLTFLoader().parseAsync(b64ToArrayBuffer(b64), '');
        // Skeleton-safe clone: plain .clone() corrupts skinned meshes.
        const cloned = SkeletonUtils.clone(parsed.scene);
        if (live) { setScene(cloned); onStatus && onStatus(''); }
      } catch (e) {
        if (live) { setError('3D model failed to load: ' + (e?.message || 'unknown')); onStatus && onStatus('3D model failed to load'); }
      }
    })();
    return () => { live = false; };
  }, []);

  if (error || !scene) {
    return (
      <View style={{ height: 300, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B3D2C', borderRadius: 16 }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return (
    <View style={{ height: 340, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0B3D2C' }}>
      <Canvas camera={{ position: [0, 1.4, 3.4], fov: 42 }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} />
        <Suspense fallback={null}>
          <RiggedFigure scene={scene} gender={gender} theme={theme} playing={playing} tempo={tempo} replayKey={replayKey} onBones={onBones} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={1.5} maxDistance={6} />
      </Canvas>
    </View>
  );
}
