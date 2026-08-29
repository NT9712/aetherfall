// Unit test for inventory + mission logic (no browser).
import { Inventory, Missions } from '../src/player/missions.js';
import { missionFor } from '../src/data/missions.js';

let pass = true;
const check = (l, ok, ex = '') => { pass = pass && ok; console.log(`  ${ok ? 'PASS' : 'FAIL'} ${l}${ex ? '  ' + ex : ''}`); };

const inv = new Inventory();
const mis = new Missions(missionFor('aetherfall'), inv);

check('mission not accepted yet', mis.canAccept());
check('cannot turn in before accepting', !mis.fulfilled());
check('accept works', mis.accept());
check('cannot accept twice', !mis.canAccept());

// partial progress
inv.add('petal', 3);
check('not fulfilled with 3/5 petals', !mis.fulfilled());
check('progress reflects 3/5', mis.progress().petal === '3/5');

// finish wild items
inv.add('petal', 5); // total 8 (carried + spent both counted)
mis.onKill(); mis.onKill();
check('wraith toll met', mis.progress().wraiths === '2/2');
inv.add('dust', 2);
check('fulfilled once items + kills present', mis.fulfilled());

// turn-in consumes the required amounts
const reward = mis.turnIn();
check('turn-in returns reward', !!reward && reward.name === 'Mending Charm');
check('reward grants maxHp', reward.maxHp === 40);
check('mission completes', mis.done);
check('consumed 5 petals (8 -> 3 left)', inv.count('petal') === 3);
check('consumed 2 dust', inv.count('dust') === 0);
check('no longer turnable-in', mis.turnIn() === null);
check('cannot re-accept after completion', !mis.canAccept());

// enemy drops accumulate inventory
{
  const inv2 = new Inventory();
  const m2 = new Missions(missionFor('embercrown'), inv2);
  check('embercrown mission requires 6 coal', missionFor('embercrown').need.coal === 6);
  inv2.add('coal', 6); inv2.add('cinder', 3);
  m2.accept();
  for (let i = 0; i < 3; i++) m2.onKill();
  check('embercrown fulfilled', m2.fulfilled());
  const r = m2.turnIn();
  check('embercrown reward', r && r.name === 'Ember Warding' && r.maxHp === 40);
}

// wild items are pickups; enemy drops are additions
{
  const inv3 = new Inventory();
  for (let i = 0; i < 10; i++) inv3.add('petal');
  for (let i = 0; i < 4; i++) inv3.add('dust');
  check('wild+drop accumulation', inv3.count('petal') === 10 && inv3.count('dust') === 4 && inv3.total() === 14);
}

// new world resets mission state
{
  const m4 = new Missions(missionFor('aetherfall'), new Inventory());
  m4.accept();
  m4.setWorld(missionFor('ashenvale'));
  check('world switch resets mission', !m4.hasActive && m4.canAccept() && missionFor('ashenvale').need.frostbell === 6);
}

console.log(pass ? '\n=== ALL PASS ===' : '\n=== FAILURES ===');
process.exit(pass ? 0 : 1);