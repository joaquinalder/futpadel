/**
 * Matchmaking — online queue or instant VS CPU match.
 */

import { Callbacks, Client } from '@colyseus/sdk';
import { NET } from '../../../shared/constants.js';

export class Matchmaking {
  constructor({ session, onMatchReady, onCancel }) {
    this.session = session;
    this.onMatchReady = onMatchReady;
    this.onCancel = onCancel;
    this.room = null;
    this.cancelled = false;
    this.vsCpu = session.mode === 'practice' || session.mode === 'cpu';
  }

  mount(root) {
    const el = document.createElement('div');
    el.className = 'screen';
    el.innerHTML = `
      <h2 style="margin:0; text-transform:uppercase; letter-spacing:0.08em;">
        ${this.vsCpu ? 'VS Máquina' : 'Buscando partida…'}
      </h2>
      <div class="spinner"></div>
      <p id="status" style="color: var(--muted);">Connecting to ${NET.URL()}</p>
      ${this.vsCpu ? '' : `<p style="color: var(--muted); font-size: 0.9rem;">
        Abre otra instancia en el navegador para jugar online.
      </p>`}
      <button class="btn secondary" id="cancel">Cancelar</button>
    `;
    root.append(el);
    this.statusEl = el.querySelector('#status');
    el.querySelector('#cancel').onclick = () => this.cancel();
    this.connect();
  }

  setStatus(msg) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }

  async connect() {
    try {
      const client = new Client(NET.URL());
      this.setStatus(this.vsCpu ? 'Creando partida contra CPU…' : 'Uniéndose a sala…');

      const options = {
        name: this.session.name,
        skin: this.session.skin,
        court: this.session.court,
        vsCpu: this.vsCpu,
      };
      const room = this.vsCpu ? await client.create('match', options) : await client.joinOrCreate('match', options);

      if (this.cancelled) {
        room.leave();
        return;
      }
      this.room = room;

      let started = false;
      const tryStart = () => {
        if (this.cancelled || started) return;
        if (room.state.players.size >= 2) {
          started = true;
          this.onMatchReady(room);
        } else if (!this.vsCpu) {
          this.setStatus('Esperando rival…');
        }
      };

      Callbacks.get(room).onAdd('players', tryStart);
    } catch (err) {
      console.error('[matchmaking] failed:', err);
      this.setStatus(`Error: ${err?.message || err}`);
    }
  }

  cancel() {
    this.cancelled = true;
    if (this.room) {
      try { this.room.leave(); } catch (_) { /* ignore */ }
    }
    this.onCancel();
  }
}
