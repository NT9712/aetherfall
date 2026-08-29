// Item definitions and world placement. All words share the same island
// geometry (only palette and climate change), so wild item spots can be
// shared; each world maps them to its own flora.

export const ITEMS = {
  petal:    { id: 'petal',    name: 'Starlit Petal', world: 'aetherfall', glyph: '❁', color: '#dffaff' },
  coal:     { id: 'coal',     name: 'Amber Coal',    world: 'embercrown', glyph: '◆', color: '#ffb45a' },
  frostbell:{ id: 'frostbell',name: 'Frost Bell',    world: 'ashenvale',  glyph: '❉', color: '#bfe6ff' },
  dust:     { id: 'dust',     name: 'Moonlit Dust',  world: 'aetherfall', glyph: '✦', color: '#cdd1ff', drop: true },
  cinder:   { id: 'cinder',   name: 'Cinder Wisp',   world: 'embercrown', glyph: '✹', color: '#ff7a3c', drop: true },
  ash:      { id: 'ash',      name: 'Quiet Ash',     world: 'ashenvale',  glyph: '❋', color: '#d8dee8', drop: true },
};

// Wild items grow at these spots (shared terrain across worlds).
export const WILD_SPOTS = [
  [34, -60], [-78, -20], [90, 40], [-20, 120], [-118, -70], [60, 120],
  [-40, -130], [110, -20],
];

export function wildItemFor(worldId) {
  if (worldId === 'embercrown') return 'coal';
  if (worldId === 'ashenvale') return 'frostbell';
  return 'petal';
}
export function dropItemFor(worldId) {
  if (worldId === 'embercrown') return 'cinder';
  if (worldId === 'ashenvale') return 'ash';
  return 'dust';
}