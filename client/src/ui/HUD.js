/**
 * Broadcast HUD — TV scoreboard + live badge + phase banner.
 */

import { SCORING } from '../../../shared/constants.js';

export class HUD {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    const sets = SCORING.SETS_TO_WIN + 1;

    const setHeaders = Array.from({ length: sets }, (_, i) =>
      `<div class="hdr">S${i + 1}</div>`,
    ).join('');

    this.root.innerHTML = `
      <div class="scoreboard" id="board">
        <div class="hdr"></div>
        ${setHeaders}
        <div class="hdr">PTS</div>
        <div class="team team-a">HOME</div>
        ${cells('A', sets)}
        <div class="team team-b">AWAY</div>
        ${cells('B', sets)}
      </div>
      <div class="broadcast-badge">
        <div class="rec"></div><span>Live</span>
      </div>
    `;

    this.banner = document.createElement('div');
    this.banner.className = 'message-banner';
    this.banner.style.display = 'none';
  }

  mount(root) {
    root.append(this.root);
    root.append(this.banner);
  }

  unmount() {
    this.root.remove();
    this.banner.remove();
  }

  update(s) {
    const set = (id, txt) => {
      const el = this.root.querySelector(id);
      if (el) el.textContent = txt;
    };
    const maxSets = SCORING.SETS_TO_WIN + 1;
    for (let i = 0; i < maxSets; i++) {
      const isCurrent = i === s.currentSet;
      set(`#A-set-${i}`, s.gamesA[i] ?? '-');
      set(`#B-set-${i}`, s.gamesB[i] ?? '-');
      this.root.querySelector(`#A-set-${i}`)?.classList.toggle('curset', isCurrent);
      this.root.querySelector(`#B-set-${i}`)?.classList.toggle('curset', isCurrent);
    }
    set('#A-pts', s.pointsA);
    set('#B-pts', s.pointsB);

    if (s.message) {
      this.banner.textContent = s.message;
      this.banner.style.display = 'block';
    } else {
      this.banner.style.display = 'none';
    }
  }
}

function cells(prefix, sets) {
  let html = '';
  for (let i = 0; i < sets; i++) {
    html += `<div class="cell" id="${prefix}-set-${i}">-</div>`;
  }
  html += `<div class="cell points" id="${prefix}-pts">0</div>`;
  return html;
}
