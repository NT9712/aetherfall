// Unit test for the adaptive quality controller (no browser needed).
import { Quality } from '../src/core/quality.js';

function simulate(fps, seconds, startLevels = [3, 3, 3]) {
  const q = new Quality({ targetFps: 60 });
  q.levels = [...startLevels];
  const dt = 1 / fps;
  for (let t = 0; t < seconds; t += dt) q.update(dt);
  return q.levels;
}

let pass = true;
const check = (label, got, want) => {
  const ok = want(got);
  pass = pass && ok;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(44)} -> [${got}]`);
};

check('30 fps sustained downshifts from High', simulate(30, 20),
  (l) => l.reduce((a, b) => a + b, 0) < 9);
check('15 fps sustained bottoms out', simulate(15, 40),
  (l) => l.reduce((a, b) => a + b, 0) <= 3);
check('144 fps sustained upshifts toward Ultra', simulate(144, 40, [1, 1, 1]),
  (l) => l.reduce((a, b) => a + b, 0) > 3);
check('60 fps steady holds its levels', simulate(60, 25),
  (l) => l.join() === '3,3,3');
check('effects shed before density', simulate(30, 6),
  (l) => l[2] < 3 && l[1] === 3);

// Manual control must disable adaptive.
const q = new Quality({ targetFps: 60 });
q.setAuto(false);
q.setLevel(1, 0);
for (let i = 0; i < 600; i++) q.update(1 / 10);   // 10 fps, would normally drop
check('manual mode ignores framerate', q.levels, (l) => l[1] === 0 && l[0] === 3);

console.log(pass ? '\n=== ALL PASS ===' : '\n=== FAILURES ===');
process.exit(pass ? 0 : 1);
