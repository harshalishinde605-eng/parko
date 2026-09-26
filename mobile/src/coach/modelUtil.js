// Coach model utilities — bone discovery, outfit themes, avatar profiles.
// Pure logic (no three.js import) so it runs in node tests.
const BONE_PATTERNS = {
  thighL: /thigh\.L/i,
  thighR: /thigh\.R/i,
  shinL: /shin\.L/i,
  shinR: /shin\.R/i,
  spine: /spine(_\.?001)?_/i,
  pelvisL: /pelvis\.L/i,
};

// Find bone objects by name pattern from a THREE.Object3D scene.
// scene arg is duck-typed ({traverse}) so tests can pass fakes.
function matchBones(scene, patterns = BONE_PATTERNS) {
  const found = {};
  const seen = {};
  scene.traverse((o) => {
    if (!o || !o.isBone || !o.name) return;
    for (const [key, re] of Object.entries(patterns)) {
      if (!seen[key] && re.test(o.name)) {
        seen[key] = true;
        found[key] = o;
      }
    }
  });
  return found;
}

function requiredForSitStand(bones) {
  const need = ['thighL', 'thighR', 'shinL', 'shinR'];
  const missing = need.filter((k) => !bones[k]);
  return { ok: missing.length === 0, missing };
}

const THEMES = {
  teal: { label: 'Teal athlete', primary: '#0B6E4F', secondary: '#E8F2EC' },
  ocean: { label: 'Ocean', primary: '#2D6CDF', secondary: '#E8F0FE' },
  coral: { label: 'Coral', primary: '#D6543B', secondary: '#FDECEC' },
  violet: { label: 'Violet', primary: '#6C4FD8', secondary: '#ECE7FB' },
};

// Rank meshes by vertex estimate heuristically via bounding-box volume.
// Caller passes [{object3D, volume, name}]; returns role mapping best-effort.
// Honest limitation: single shared materials + generic names mean per-part
// (shirt vs pants) mapping cannot be guaranteed — themes are the contract.
function mapMeshRoles(meshes) {
  const sorted = [...meshes].sort((a, b) => b.volume - a.volume);
  const roles = {};
  if (sorted[0]) roles.body = sorted[0].object3D;
  if (sorted[1]) roles.accent = sorted[1].object3D;
  return roles;
}

module.exports = { BONE_PATTERNS, matchBones, requiredForSitStand, THEMES, mapMeshRoles };
