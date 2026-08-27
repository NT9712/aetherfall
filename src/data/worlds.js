// The worlds of AETHERFALL and everything written about them.
//
// Each world recolors the sky, water, terrain and flora (all driven by
// shader uniforms), carries its own lore steles and its own shard journey, and
// is reached through the Embergates — the standing arches of Lyra's realm.

export const WORLDS = [
  {
    id: 'aetherfall',
    name: 'Aetherfall',
    tagline: 'The Meadow Isle',
    loreIntro:
      'Long before the first tide, a ribbon of living starlight — the Starlace — was ' +
      'woven across the heavens by Lyra the Skyward. When it frayed, its shards fell ' +
      'upon Aetherfall, and the sky forgot how to sing.',
    sub: 'Restore the Starlace — gather its fallen shards',
    spawn: [14, -20],
    palette: {
      fog: '#bfdcec',
      skyZenith: '#2e79cf', skyHorizon: '#cfe9f2', sunTint: '#fff3cf',
      cloudLit: '#fffdf6', cloudShade: '#9fb2cc',
      waterShallow: [0.30, 0.82, 0.78], waterMid: [0.14, 0.66, 0.74], waterDeep: [0.06, 0.42, 0.64],
      grassA: [0.300, 0.512, 0.196], grassB: [0.540, 0.700, 0.290], grassC: [0.395, 0.580, 0.230],
      dirt: [0.42, 0.33, 0.23], sand: [0.906, 0.827, 0.584],
      rockA: [0.482, 0.443, 0.384], rockB: [0.330, 0.305, 0.270],
      snow: [0.93, 0.96, 0.97], wet: [0.14, 0.48, 0.50],
    },
    stones: [
      { pos: [14, -18], rotY: 0.6, name: 'Stele of Dawn',
        text: 'Here the Skyward one descended, robes bright as first light.\nShe sang to the void, and the void answered with islands.\n"What is woven from song," she wrote, "can never truly unravel — only sleep."' },
      { pos: [-96, 44], rotY: -1.1, name: 'Stele of the Fray',
        text: 'On the night of the Sundering, the Starlace cracked like winter ice.\nSeven embers fell hissing into the sea, and where each landed,\nthe grass still remembers the shape of the light.' },
      { pos: [88, 92], rotY: 2.2, name: 'Stele of Tides',
        text: 'Traveler — the shards are not lost, they are listening.\nThey rise toward any heart that carries the melody\nLyra left in the wind. Walk the high grass and you will hear it too.' },
      { pos: [-30, -120], rotY: 0.3, name: 'Stele of Return',
        text: 'Gather all seven, and hold them against the dusk.\nThe Starlace will remember its own name,\nand dawn will break twice on Aetherfall Isle.' },
      { pos: [40, -70], rotY: -0.5, name: 'Codex of Passages',
        text: 'The girl who speaks to stars did not come to build walls.\nBeyond the Embergate lies what she left unfinished — Embercrown,\nand the white silence of the Ashen Vale.' },
    ],
    shards: [[22,-34],[-52,8],[64,30],[-98,58],[90,84],[-38,-112],[12,136]],
  },

  {
    id: 'embercrown',
    name: 'Embercrown',
    tagline: 'The Autumn Wastes',
    loreIntro:
      'Where the Starlace wept, Embercrown burned and never forgot. Amber rivers run ' +
      'through iron canyons, and the ash recalls the shape of the trees it once consumed.',
    sub: 'Quench the crown — gather the embers that still smoulder',
    spawn: [-20, -40],
    palette: {
      fog: '#e2c9a3',
      skyZenith: '#3d6fb5', skyHorizon: '#eed9b0', sunTint: '#ffe2a8',
      cloudLit: '#fff2dd', cloudShade: '#c0986e',
      waterShallow: [0.55, 0.42, 0.18], waterMid: [0.38, 0.22, 0.12], waterDeep: [0.16, 0.08, 0.05],
      grassA: [0.45, 0.34, 0.16], grassB: [0.66, 0.42, 0.18], grassC: [0.50, 0.38, 0.20],
      dirt: [0.45, 0.26, 0.12], sand: [0.80, 0.62, 0.42],
      rockA: [0.52, 0.36, 0.28], rockB: [0.40, 0.26, 0.20],
      snow: [0.88, 0.80, 0.72], wet: [0.34, 0.20, 0.12],
    },
    stones: [
      { pos: [-20, -40], rotY: 1.2, name: 'Stele of the Crown',
        text: 'They crowned a dead king here and called it mercy.\nThe embers remember his name. The canyons do not let it go.' },
      { pos: [-110, 30], rotY: -0.8, name: 'Stele of Ashes',
        text: 'Everything the fire loved, it kept.\nThe trees went to ash with their roots still held.\nWeep not for Embercrown — it drowns in everything it kept.' },
      { pos: [70, -110], rotY: 2.0, name: 'Stele of the River',
        text: 'The amber river carries no water, only wish and ember.\nThrow a coin in and it returns as a story you cannot put down.' },
      { pos: [30, 80], rotY: 0.4, name: 'Stele of the Last Harvest',
        text: 'The last harvest never came in.\nThe king waited at the gate until his crown cooled.\nSome ends are smaller than the hand that waits for them.' },
    ],
    shards: [[-50,10],[70,30],[-110,60],[90,-60],[-20,90],[50,-20]],
  },

  {
    id: 'ashenvale',
    name: 'Ashen Vale',
    tagline: 'The White Silence',
    loreIntro:
      'Beyond the second gate, the Vale stands silent under a pale sun. It is not a ' +
      'sad place — it is a waiting place, and what it waits for is you.',
    sub: 'Wake the vale — gather the frozen petals of the Starlace',
    spawn: [0, -30],
    palette: {
      fog: '#cdd8e2',
      skyZenith: '#7fa4c9', skyHorizon: '#e3ecf2', sunTint: '#eefbff',
      cloudLit: '#f8fcff', cloudShade: '#b7c6d6',
      waterShallow: [0.55, 0.72, 0.78], waterMid: [0.30, 0.55, 0.66], waterDeep: [0.12, 0.30, 0.42],
      grassA: [0.42, 0.52, 0.50], grassB: [0.60, 0.68, 0.60], grassC: [0.48, 0.58, 0.55],
      dirt: [0.36, 0.36, 0.34], sand: [0.78, 0.80, 0.78],
      rockA: [0.55, 0.55, 0.56], rockB: [0.40, 0.40, 0.42],
      snow: [0.94, 0.96, 0.98], wet: [0.30, 0.40, 0.46],
    },
    stones: [
      { pos: [0, -30], rotY: 1.9, name: 'Stele of the Still',
        text: 'The Vale does not mourn. It is simply out of time for it.\nLie down in the white and the Vale will keep your hour safe.' },
      { pos: [-95, -40], rotY: -1.4, name: 'Stele of the Quiet King',
        text: 'He rules nothing now but the pause between heartbeats.\nBow low. He is polite. He will bow back.' },
      { pos: [90, 40], rotY: 0.7, name: 'Stele of the Frozen Shrine',
        text: 'The petals fell before they could sing.\nGather them gently — cold things can still be patient,\nand patience is the loudest form of hope.' },
      { pos: [20, 110], rotY: 2.6, name: 'Stele of the Last Comet',
        text: 'When the Vale is whole again it will cross into the next sky.\nAnd it will be a long, white thing moving slowly in the dark.\nThat is how you will know it is happy.' },
    ],
    shards: [[-40,20],[60,60],[-90,90],[30,-100],[0,60]],
  },
];

// Aetherfall keeps its classic 7-shard journey; the other worlds are shorter.
export const FINALE = {
  aetherfall:
    'The seven shards rise from your hands and thread themselves into the dusk.\n' +
    'Above the isle, the Starlace re-weaves — and the sky remembers its song.\n' +
    'Far off, the Embergate hums, warm now.\n\nThere are other skies waiting.',
  embercrown:
    'The embers cool at last and settle into the amber river,\n' +
    'and Embercrown lets out a breath it has held for a very long time.\n\nThere is a pale gate, and behind it, a silence with your name on it.',
  ashenvale:
    'The petals turn, and the waiting place remembers it was a garden.\n' +
    'Ashen Vale crosses into the next sky, slow and white and glad.\n\nThank you for walking the worlds.',
};