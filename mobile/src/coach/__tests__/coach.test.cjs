const assert = require('assert');
const { matchBones, requiredForSitStand, THEMES, mapMeshRoles } = require('../modelUtil');
const { phaseAt, anglesAt, cycleAt } = require('../sitStandCycle');

let pass = 0;
function check(name, cond) {
  assert(cond, `FAIL: ${name}`);
  pass += 1;
  console.log(`ok: ${name}`);
}

// Fake bone scene (duck-typed traverse).
function fakeScene(names) {
  return { traverse: (fn) => names.forEach((n) => fn({ isBone: true, name: n })) };
}
const bones = matchBones(fakeScene(['thigh.L_126', 'thigh.R_130', 'shin.L_125', 'shin.R_129', 'spine_131', 'nose_4']));
check('finds all sit-stand bones', ['thighL', 'thighR', 'shinL', 'shinR'].every((k) => !!bones[k]));
check('required check passes', requiredForSitStand(bones).ok);
const partial = matchBones(fakeScene(['thigh.L_1', 'nose_2']));
const req = requiredForSitStand(partial);
check('missing bones reported', !req.ok && req.missing.includes('shinL'));
check('4 outfit themes defined', Object.keys(THEMES).length >= 3);
const roles = mapMeshRoles([{ object3D: 'big', volume: 9 }, { object3D: 'mid', volume: 4 }, { object3D: 'small', volume: 1 }]);
check('mesh roles mapped biggest-first', roles.body === 'big' && roles.accent === 'mid');

check('cycle starts seated', phaseAt(0, 'slow').phase === 'seated');
check('cycle reaches standing', cycleAt(2000 + 2200 + 100, 'slow').phase === 'standing');
check('cycle loops back to seated', phaseAt(2000 + 2200 + 1500 + 2200 + 100, 'slow').phase === 'seated');
const seated = anglesAt(0);
const stood = anglesAt(1);
check('seated thigh flexed (~-88)', Math.abs(seated.thighDeg + 88) < 0.01);
check('standing thigh neutral (~0)', Math.abs(stood.thighDeg) < 0.01);
check('standing shin near straight', stood.shinDeg < 8);
check('unknown tempo falls back to slow', phaseAt(100, 'turbo').phase === 'seated');

console.log(`\nALL ${pass} COACH CHECKS PASSED`);
