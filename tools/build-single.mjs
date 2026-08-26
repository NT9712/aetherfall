// Build a single self-contained HTML file: Three.js + addons + all game
// modules + CSS inlined. Runs offline from file:// with no server.
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = path.resolve('.');

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  legalComments: 'none',
  target: ['chrome100', 'firefox100', 'safari15'],
  alias: {
    'three/addons': path.join(root, 'node_modules/three/examples/jsm'),
  },
  write: false,
});

const js = result.outputFiles[0].text;

// Take the CSS + body markup from index.html, drop the importmap/module tags.
const html = fs.readFileSync('index.html', 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AETHERFALL — Whispers of the Sunken Starlace</title>
<meta name="description" content="A third-person open-world adventure vignette in Three.js — collect the seven fallen shards of the Starlace.">
<meta property="og:title" content="AETHERFALL — Whispers of the Sunken Starlace">
<meta property="og:description" content="A cel-shaded open-world vignette built in Three.js. Every mesh, texture, shader and note of music is procedural.">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3CradialGradient id='g' cx='40%25' cy='35%25'%3E%3Cstop offset='0' stop-color='%23dffaff'/%3E%3Cstop offset='.6' stop-color='%2358c8f0'/%3E%3Cstop offset='1' stop-color='%232a86c8'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='32' height='32' fill='%230a1626'/%3E%3Cpath d='M16 3l7 13-7 13-7-13z' fill='url(%23g)'/%3E%3C/svg%3E">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Alegreya:ital,wght@0,500;1,400&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<div id="ui"></div>
<script>${js}</script>
</body>
</html>
`;

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/aetherfall.html', out);
const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log(`dist/aetherfall.html  ${kb} KB  (fully self-contained)`);
