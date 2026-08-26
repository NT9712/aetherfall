// The written soul of the game: world name, quest text, stone inscriptions.

export const WORLD = {
  title: 'AETHERFALL',
  subtitle: 'Whispers of the Sunken Starlace',
  intro:
    'Long before the first tide, a ribbon of living starlight — the Starlace — ' +
    'was woven across the heavens by Lyra the Skyward. When it frayed, seven ' +
    'shards fell upon this isle, and the sky forgot how to sing.',
  goal: 'Restore the Starlace — gather the 7 fallen shards',
};

export const STONES = [
  {
    pos: [14, -18],
    rotY: 0.6,
    name: 'Stele of Dawn',
    text:
      'Here the Skyward one descended, robes bright as first light.\n' +
      'She sang to the void, and the void answered with islands.\n' +
      '"What is woven from song," she wrote, "can never truly unravel — only sleep."',
  },
  {
    pos: [-96, 44],
    rotY: -1.1,
    name: 'Stele of the Fray',
    text:
      'On the night of the Sundering, the Starlace cracked like winter ice.\n' +
      'Seven embers fell hissing into the sea, and where each landed,\n' +
      'the grass still remembers the shape of the light.',
  },
  {
    pos: [88, 92],
    rotY: 2.2,
    name: 'Stele of Tides',
    text:
      'Traveler — the shards are not lost, they are listening.\n' +
      'They rise toward any heart that carries the melody\n' +
      'Lyra left in the wind. Walk the high grass and you will hear it too.',
  },
  {
    pos: [-30, -120],
    rotY: 0.3,
    name: 'Stele of Return',
    text:
      'Gather all seven, and hold them against the dusk.\n' +
      'The Starlace will remember its own name,\n' +
      'and dawn will break twice on Aetherfall Isle.',
  },
];

// 7 shard positions — hand-placed across the island for a journey:
// meadow → beach → cliffs → mountain approach → summit vista.
export const SHARDS = [
  [22, -34],
  [-52, 8],
  [64, 30],
  [-98, 58],
  [90, 84],
  [-38, -112],
  [12, 136],
];

export const FINALE_TEXT =
  'The seven shards rise from your hands, threading themselves into the dusk.\n' +
  'Above the isle, the Starlace re-weaves — and for the first time in an age,\n' +
  'the sky remembers its song.\n\n' +
  'Thank you for playing AETHERFALL.';
