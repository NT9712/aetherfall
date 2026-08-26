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
    showFinale() {
      $('finale').classList.remove('hidden');
      $('btn-roam').addEventListener('click', () => $('finale').classList.add('hidden'));
    },
  };
}
