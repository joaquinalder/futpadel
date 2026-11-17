/**
 * SkinSelect — pick the player's outfit.
 */

import { SKINS } from '../../../shared/constants.js';

export class SkinSelect {
  constructor({ session, onChoose, onBack }) {
    this.session = session;
    this.onChoose = onChoose;
    this.onBack = onBack;
  }

  mount(root) {
    const el = document.createElement('div');
    el.className = 'screen';
    el.innerHTML = `
      <h2 style="margin:0; text-transform:uppercase; letter-spacing:0.08em;">Elige tu jugador</h2>
      <div class="choice-grid" id="grid"></div>
      <div style="display:flex;gap:1rem;">
        <button class="btn secondary" id="back">Back</button>
        <button class="btn" id="next">Find match</button>
      </div>
    `;
    root.append(el);
    const grid = el.querySelector('#grid');
    let selected = this.session.skin;

    const render = () => {
      grid.replaceChildren();
      for (const s of SKINS) {
        const div = document.createElement('div');
        div.className = 'choice' + (s.id === selected ? ' selected' : '');
        div.innerHTML = `
          <div class="swatch" style="
            background: linear-gradient(180deg, ${s.skin} 0%, ${s.skin} 22%, ${s.hairColor || '#111'} 22%, ${s.hairColor || '#111'} 32%, ${s.primary} 32%, ${s.primary} 72%, ${s.secondary} 72%);
          "></div>
          <div class="name">${s.name}</div>
          <div style="font-size:0.75rem;color:var(--muted);">#${s.number ?? '—'}</div>
        `;
        div.onclick = () => { selected = s.id; render(); };
        grid.append(div);
      }
    };
    render();

    el.querySelector('#back').onclick = () => this.onBack();
    el.querySelector('#next').onclick = () => this.onChoose(selected);
  }
}
