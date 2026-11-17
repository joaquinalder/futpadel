/**
 * CourtSelect — grid of the available courts. Each option shows a coloured
 * swatch matching the court's floor/walls/accent palette.
 */

import { COURTS } from '../../../shared/constants.js';

export class CourtSelect {
  constructor({ session, onChoose, onBack }) {
    this.session = session;
    this.onChoose = onChoose;
    this.onBack = onBack;
  }

  mount(root) {
    const el = document.createElement('div');
    el.className = 'screen';
    el.innerHTML = `
      <h2 style="margin:0;">Pick a court</h2>
      <div class="choice-grid" id="grid"></div>
      <div style="display:flex;gap:1rem;">
        <button class="btn secondary" id="back">Back</button>
        <button class="btn" id="next">Continue</button>
      </div>
    `;
    root.append(el);
    const grid = el.querySelector('#grid');
    let selected = this.session.court;

    const render = () => {
      grid.replaceChildren();
      for (const c of COURTS) {
        const div = document.createElement('div');
        div.className = 'choice' + (c.id === selected ? ' selected' : '');
        div.innerHTML = `
          <div class="swatch" style="
            background: linear-gradient(135deg, ${c.floor} 0%, ${c.floor} 60%, ${c.walls} 60%, ${c.walls} 100%);
            border: 3px solid ${c.accent};
          "></div>
          <div class="name">${c.name}</div>
        `;
        div.onclick = () => { selected = c.id; render(); };
        grid.append(div);
      }
    };
    render();

    el.querySelector('#back').onclick = () => this.onBack();
    el.querySelector('#next').onclick = () => this.onChoose(selected);
  }
}
