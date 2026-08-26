// All DOM UI: title screen, quest tracker, stamina, prompts, dialogue box,
// shard counter, toasts and the finale overlay.

import { WORLD, FINALE_TEXT } from '../data/lore.js';

export function createHUD() {
  const el = document.getElementById('ui');

  el.innerHTML = `
    <div id="title-screen">
      <div class="title-inner">
        <div class="title-eyebrow">an open-world vignette</div>
        <h1>${WORLD.title}</h1>
        <div class="title-sub">${WORLD.subtitle}</div>
        <p class="title-intro">${WORLD.intro}</p>
        <button id="btn-begin">Begin the Journey</button>
        <div class="title-controls">
          <span><b>WASD</b> move</span>
          <span><b>Shift</b> sprint</span>
          <span><b>Space</b> jump / glide</span>
          <span><b>E</b> interact</span>
          <span><b>Mouse</b> look · <b>Wheel</b> zoom</span>
          <span><b>M</b> music</span>
        </div>
      </div>
    </div>

    <div id="tracker" class="panel hidden">
      <div class="tracker-title">✦ ${WORLD.goal}</div>
      <div id="shard-pips"></div>
    </div>

    <div id="stamina-wrap" class="hidden"><div id="stamina-bar"></div></div>

    <div id="prompt" class="hidden"></div>
    <div id="toast" class="hidden"></div>

    <div id="dialogue" class="hidden">
      <div id="dlg-name"></div>
      <div id="dlg-text"></div>
      <div id="dlg-hint">[ E ] close</div>
    </div>

    <div id="finale" class="hidden">
      <h2>The Starlace Reborn</h2>
      <p>${FINALE_TEXT.replaceAll('\n', '<br>')}</p>
      <button id="btn-roam">Keep Wandering</button>
    </div>

    <div id="pause" class="hidden">
      <div class="pause-card">
        <div class="pause-eyebrow">Aetherfall Isle</div>
        <h2>Paused</h2>
        <div id="pause-progress"></div>
        <div class="pause-actions">
          <button id="btn-resume">Resume</button>
          <button id="btn-graphics">Graphics</button>
          <button id="btn-mute">Sound: On</button>
          <button id="btn-title">Return to Title</button>
        </div>
        <div class="pause-controls">
          <span><b>WASD</b> move</span><span><b>Shift</b> sprint</span>
          <span><b>Space</b> jump / glide</span><span><b>E</b> interact</span>
          <span><b>Tab</b> graphics</span><span><b>Esc</b> pause</span>
        </div>
      </div>
    </div>

    <div id="perf">
      <div id="perf-fps"><b>--</b> fps</div>
      <div id="perf-cull"></div>
    </div>

    <div id="settings" class="hidden">
      <div class="set-title">Graphics</div>
      <label class="set-auto">
        <input type="checkbox" id="set-auto" checked>
        <span>Adaptive &mdash; match quality to framerate</span>
      </label>
      <div class="set-row">
        <span class="set-label">Render Distance</span>
        <input type="range" id="set-0" min="0" max="4" step="1" value="3">
        <span class="set-val" id="val-0">High</span>
      </div>
      <div class="set-row">
        <span class="set-label">Vegetation Density</span>
        <input type="range" id="set-1" min="0" max="4" step="1" value="3">
        <span class="set-val" id="val-1">High</span>
      </div>
      <div class="set-row">
        <span class="set-label">Effects Quality</span>
        <input type="range" id="set-2" min="0" max="4" step="1" value="3">
        <span class="set-val" id="val-2">High</span>
      </div>
      <div class="set-hint">Density and distance rebuild nothing &mdash; they retune the
        live scene. <b>Tab</b> closes.</div>
    </div>

    <div id="vignette-frame"></div>
  `;

  const $ = (id) => el.querySelector('#' + id);

  // Shard pips in tracker.
  const pipsEl = $('shard-pips');
  for (let i = 0; i < 7; i++) {
    const pip = document.createElement('span');
    pip.className = 'pip';
    pipsEl.appendChild(pip);
  }

  let toastTimer = null;
  let typeTimer = null;
  let onResume = null, onTitle = null, onMute = null;
  const TIER = ['Potato', 'Low', 'Medium', 'High', 'Ultra'];
  let onQuality = null;
  let onAuto = null;
  let perfAcc = 0;

  for (let i = 0; i < 3; i++) {
    $('set-' + i).addEventListener('input', (e) => {
      const v = Number(e.target.value);
      $('val-' + i).textContent = TIER[v];
      if (onQuality) onQuality(i, v);
    });
  }
  $('set-auto').addEventListener('change', (e) => { if (onAuto) onAuto(e.target.checked); });
  $('btn-resume').addEventListener('click', () => { if (onResume) onResume(); });
  $('btn-graphics').addEventListener('click', () => $('settings').classList.toggle('hidden'));
  $('btn-mute').addEventListener('click', () => { if (onMute) onMute(); });
  $('btn-title').addEventListener('click', () => { if (onTitle) onTitle(); });

  return {
    showTitle(onBegin) {
      $('title-screen').classList.remove('hidden');
      $('btn-begin').addEventListener('click', () => {
        $('title-screen').classList.add('hidden');
        onBegin();
      });
    },
    enterWorld() {
      $('tracker').classList.remove('hidden');
    },
    setShards(n) {
      [...pipsEl.children].forEach((p, i) => p.classList.toggle('lit', i < n));
    },
    setStamina(frac) {
      const wrap = $('stamina-wrap');
      if (frac >= 0.999) wrap.classList.add('hidden');
      else {
        wrap.classList.remove('hidden');
        $('stamina-bar').style.width = `${frac * 100}%`;
        wrap.classList.toggle('low', frac < 0.25);
      }
    },
    setPrompt(text) {
      const p = $('prompt');
      if (!text) { p.classList.add('hidden'); return; }
      p.textContent = text;
      p.classList.remove('hidden');
    },
    toast(msg, ms = 2600) {
      const t = $('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
    },
    openDialogue(name, text, onDone) {
      const dlg = $('dialogue');
      dlg.classList.remove('hidden');
      $('dlg-name').textContent = name;
      const target = $('dlg-text');
      target.textContent = '';
      clearInterval(typeTimer);
      let i = 0;
      const step = () => {
        if (i < text.length) {
          target.textContent += text[i];
          i++;
          typeTimer = setTimeout(step, text[i - 1] === '\n' ? 220 : 16);
        }
      };
      step();
      this._closeDlg = onDone;
    },
    closeDialogue() {
      $('dialogue').classList.add('hidden');
      clearInterval(typeTimer);
      if (this._closeDlg) { this._closeDlg(); this._closeDlg = null; }
    },
    get dialogueOpen() {
      return !$('dialogue').classList.contains('hidden');
    },
    // ---- pause menu ----
    onResumeClick(fn) { onResume = fn; },
    onTitleClick(fn) { onTitle = fn; },
    onMuteClick(fn) { onMute = fn; },
    setMuteLabel(on) { $('btn-mute').textContent = `Sound: ${on ? 'On' : 'Off'}`; },
    openPause(shards, total) {
      $('pause-progress').innerHTML =
        `<span class="pause-shards">${shards} / ${total}</span> shards recovered`;
      $('pause').classList.remove('hidden');
    },
    closePause() {
      $('pause').classList.add('hidden');
      $('settings').classList.add('hidden');
    },
    get paused() { return !$('pause').classList.contains('hidden'); },

    onQualityChange(fn) { onQuality = fn; },
    setAutoChecked(v) { $('set-auto').checked = v; },
    onAutoChange(fn) { onAuto = fn; },
    toggleSettings() {
      const el2 = $('settings');
      el2.classList.toggle('hidden');
      return !el2.classList.contains('hidden');
    },
    // Reflect adaptive changes back into the sliders.
    syncQuality(levels) {
      for (let i = 0; i < 3; i++) {
        $('set-' + i).value = String(levels[i]);
        $('val-' + i).textContent = TIER[levels[i]];
      }
    },
    setPerf(fps, levels, cullStats, grassStats, tris, calls) {
      perfAcc++;
      if (perfAcc % 12) return;         // throttle DOM writes
      $('perf-fps').innerHTML = `<b>${Math.round(fps)}</b> fps`;
      const c = cullStats || { drawn: 0, total: 0, byFrustum: 0, byOcclusion: 0, byDistance: 0 };
      const g = grassStats || { drawn: 0, chunks: 0 };
      $('perf-cull').innerHTML =
        `sectors ${c.drawn}/${c.total} &middot; grass ${g.drawn}/${g.chunks}<br>` +
        `culled: ${c.byDistance} far &middot; ${c.byFrustum} view &middot; ${c.byOcclusion} hidden` +
        (tris ? `<br>${(tris / 1000).toFixed(0)}k tris &middot; ${calls} calls` : '');
      this.syncQuality(levels);
    },
    showFinale() {
      $('finale').classList.remove('hidden');
      $('btn-roam').addEventListener('click', () => $('finale').classList.add('hidden'));
    },
  };
}
