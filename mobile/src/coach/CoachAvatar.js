import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Asset } from 'expo-asset';
import { matchBones, requiredForSitStand } from './modelUtil';
import { cycleAt } from './sitStandCycle';
import { C } from '../theme';

const rad = (d) => (d * Math.PI) / 180;

// Classify meshes for outfit theming: shirt = torso-band, compact meshes.
function classifyMeshes(root, totalH) {
  const out = [];
  root.traverse((o) => {
    if (!o || !o.isMesh) return;
    try {
      const box = new THREE.Box3().setFromObject(o);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const h = size.y / totalH;
      const cy = center.y / totalH;
      out.push({ object3D: o, name: o.name, volume: size.x * size.y * size.z, h, cy });
    } catch { /* ignore */ }
  });
  return out;
}

function RiggedFigure({ scene, gender, theme, playing, tempo, replayKey, onBones }) {
  const bonesRef = useRef(null);
  const restRef = useRef({});
  const clockRef = useRef(0);
  const shirtRef = useRef([]);

  const prepared = useMemo(() => {
    // Gender subtree: hide the other model's root.
    const roots = [];
    scene.traverse((o) => { if (o && /rootJoint/i.test(o.name || '')) roots.push(o); });
    let showIdx = 0;
    if (/female|woman|girl|lady/i.test(gender || '')) showIdx = roots.length > 1 ? 1 : 0;
    roots.forEach((r, i) => { r.visible = i === showIdx; });
    // Outfit theme: clone materials, tint torso-band meshes primary.
    let totalH = 3.5;
    try {
      const box = new THREE.Box3().setFromObject(scene);
      const s = new THREE.Vector3();
      box.getSize(s);
      if (s.y > 0.5) totalH = s.y;
    } catch { /* ignore */ }
    const shirt = [];
    scene.traverse((o) => {
      if (!o || !o.isMesh || !o.material) return;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      try {
        const b = new THREE.Box3().setFromObject(o);
        const sz = new THREE.Vector3(); b.getSize(sz);
        const c = new THREE.Vector3(); b.getCenter(c);
        // bbox min unknown in world; use relative: shirt if compact mid-band
        if (sz.y / totalH < 0.6 && c.y / totalH > 0.35 && c.y / totalH < 0.85) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.color && m.color.set(theme.primary));
          shirt.push(o.name || 'mesh');
        }
      } catch { /* ignore */ }
    });
    const bones = matchBones(scene);
    Object.values(bones).forEach((bn) => { restRef.current[bn.name] = bn.quaternion.clone(); });
    return { bones, shirt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, gender, theme.primary]);

  useEffect(() => {
    onBones && onBones({ ok: requiredForSitStand(prepared.bones).ok, missing: requiredForSitStand(prepared.bones).missing, shirtMeshes: prepared.shirt });
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

function Loader({ modelUri, gender, theme, playing, tempo, replayKey, onBones }) {
  const { scene } = useGLTF(modelUri);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <RiggedFigure scene={cloned} gender={gender} theme={theme} playing={playing} tempo={tempo} replayKey={replayKey} onBones={onBones} />;
}

export default function CoachAvatar({ gender, theme, playing, tempo = 'slow', replayKey = 0, onStatus, onBones }) {
  const [uri, setUri] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        onStatus && onStatus('Loading 3D coach…');
        const asset = Asset.fromModule(require('../../assets/coach.glb'));
        await asset.downloadAsync();
        if (live) { setUri(asset.localUri || asset.uri); onStatus && onStatus(''); }
      } catch (e) {
        if (live) { setError('3D model failed to load: ' + (e?.message || 'unknown')); onStatus && onStatus('3D model failed to load'); }
      }
    })();
    return () => { live = false; };
  }, []);

  if (error || !uri) {
    return (
      <View style={{ height: 300, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B3D2C', borderRadius: 16 }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return (
    <View style={{ height: 340, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0B3D2C' }}>
      <Canvas camera={{ position: [0, 1.2, 3.2], fov: 42 }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <Suspense fallback={null}>
          <Loader modelUri={uri} gender={gender} theme={theme} playing={playing} tempo={tempo} replayKey={replayKey} onBones={onBones} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={1.5} maxDistance={6} />
      </Canvas>
    </View>
  );
}
