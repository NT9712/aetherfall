// Side missions: each asks for wild items plus a few Wraith kills, and trades
// them in for a meaningful reward (a permanent max-health charm + a full mend).

export const MISSIONS = {
  'aetherfall': {
    id: 'cartwright', giver: 'Wandering Cartwright', title: 'The Cartwright\'s Charge',
    text:
      'I\'m patching carts for half the north road and I\'m out of cord.\n' +
      'Bring me the petals the wind drops, and show the Wraiths at our gates\n' +
      'that two is plenty — then I\'ll mend you properly, free of charge.',
    need: { petal: 5, dust: 2, wraiths: 2 },
    reward: { name: 'Mending Charm', maxHp: 40, heal: true },
  },
  'embercrown': {
    id: 'lampwright', giver: 'Lampwright Otho', title: 'Lampwright Otho\'s Fuel',
    text:
      'The amber river gives up coal for anyone brave enough to wade.\n' +
      'Collect six lumps for my lamps, and scatter three of the living cinders,\n' +
      'and I will line your lamp with warmth that the dark cannot put out.',
    need: { coal: 6, cinder: 3, wraiths: 3 },
    reward: { name: 'Ember Warding', maxHp: 40, heal: true },
  },
  'ashenvale': {
    id: 'bellringer', giver: 'The Bell-Keeper', title: 'The Bell-Keeper\'s Claim',
    text:
      'The vale rings for no one since the quiet fell. Gather six frozen bells,\n' +
      'and carry two handfuls of ash upward, and I will carve you a bell that\n' +
      'rings in the living dark.',
    need: { frostbell: 6, ash: 2, wraiths: 2 },
    reward: { name: 'Stillwater Charm', maxHp: 40, heal: true },
  },
};

export function missionFor(worldId) {
  return MISSIONS[worldId];
}