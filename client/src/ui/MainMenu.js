/**
 * MainMenu — title screen with Play / Skin / Quit buttons and a name input.
 */

export class MainMenu {
  constructor({ session, onPlay, onPractice, onSkin, onQuit }) {
    this.session = session;
    this.onPlay = onPlay;
    this.onPractice = onPractice;
    this.onSkin = onSkin;
    this.onQuit = onQuit;
  }

  mount(root) {
    const el = document.createElement('div');
    el.className = 'screen';
    el.innerHTML = `
      <h1 class="title">FUT<span>PADEL</span></h1>
      <p class="subtitle">Official Broadcast · Season 26</p>
      <div class="menu-card">
        <input id="name-input" type="text" placeholder="Your name" value="${escapeHtml(this.session.name)}" />
        <button class="btn" id="play">Partida online</button>
        <button class="btn secondary" id="cpu">VS Máquina</button>
        <button class="btn secondary" id="skin">Elegir pista y jugador</button>
        <button class="btn ghost" id="quit">Quit</button>
      </div>
      <div class="controls-hint">
        <span><kbd>WASD</kbd> Mover</span>
        <span><kbd>Mantener + soltar</kbd> Cargar potencia</span>
        <span><kbd>Space</kbd> Normal / Saque</span>
        <span><kbd>Shift</kbd> Picada</span>
        <span><kbd>Ctrl</kbd> Remate</span>
        <span><kbd>E</kbd> Especial</span>
        <span><kbd>Tab</kbd> Cambiar vista</span>
      </div>
    `;
    root.append(el);

    const nameInput = el.querySelector('#name-input');
    nameInput.addEventListener('input', () => {
      this.session.name = nameInput.value.trim() || 'Player';
      localStorage.setItem('futpadel:name', this.session.name);
    });
    el.querySelector('#play').onclick = () => this.onPlay();
    el.querySelector('#cpu').onclick = () => this.onPractice?.();
    el.querySelector('#skin').onclick = () => this.onSkin();
    el.querySelector('#quit').onclick = () => this.onQuit?.();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
