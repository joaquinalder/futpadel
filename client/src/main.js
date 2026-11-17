/**
 * Renderer entry point. Boots three.js, owns the screen router, and wires
 * the UI screens (menu → court → skin → matchmaking → game).
 */

// Show any fatal error on screen instead of just the DevTools console —
// during development a silent crash leaves the user staring at a blue page.
function showFatal(err) {
  console.error('[futpadel] fatal:', err);
  const root = document.getElementById('ui-root') || document.body;
  const div = document.createElement('div');
  div.style.cssText = `
    position: absolute; inset: 0; padding: 2rem;
    color: #fecaca; background: rgba(15, 23, 42, 0.95);
    font-family: Consolas, monospace; font-size: 14px;
    white-space: pre-wrap; overflow: auto; z-index: 9999;
    pointer-events: auto;
  `;
  div.textContent =
    'Futpadel crashed:\n\n' +
    (err && err.stack ? err.stack : String(err));
  root.append(div);
}
window.addEventListener('error', (e) => showFatal(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showFatal(e.reason));

import { Game } from './game/Game.js';
import { MainMenu } from './ui/MainMenu.js';
import { CourtSelect } from './ui/CourtSelect.js';
import { SkinSelect } from './ui/SkinSelect.js';
import { Matchmaking } from './ui/Matchmaking.js';
import { HUD } from './ui/HUD.js';

const uiRoot = document.getElementById('ui-root');
const canvas = document.getElementById('game-canvas');

const session = {
  name: localStorage.getItem('futpadel:name') || 'Player',
  court: localStorage.getItem('futpadel:court') || 'classic',
  skin:  localStorage.getItem('futpadel:skin')  || 'red',
  mode:  'online',
};

const game = new Game(canvas);

function go(screen) {
  uiRoot.replaceChildren();
  screen.mount(uiRoot);
}

function showMenu() {
  game.idleScene();
  go(new MainMenu({
    session,
    onPlay: () => { session.mode = 'online'; showCourtSelect(); },
    onPractice: () => { session.mode = 'cpu'; showCourtSelect(); },
    onSkin: () => showSkinSelect(),
    onQuit: () => window.futpadel?.quit?.(),
  }));
}

function showCourtSelect() {
  go(new CourtSelect({
    session,
    onChoose: (court) => {
      session.court = court;
      localStorage.setItem('futpadel:court', court);
      showSkinSelect();
    },
    onBack: showMenu,
  }));
}

function showSkinSelect() {
  go(new SkinSelect({
    session,
    onChoose: (skin) => {
      session.skin = skin;
      localStorage.setItem('futpadel:skin', skin);
      showMatchmaking();
    },
    onBack: showMenu,
  }));
}

function showMatchmaking() {
  go(new Matchmaking({
    session,
    onMatchReady: (room) => startMatch(room),
    onCancel: showMenu,
  }));
}

function startMatch(room) {
  uiRoot.replaceChildren();
  const hud = new HUD();
  hud.mount(uiRoot);
  game.startMatch(room, session, hud, () => {
    hud.unmount();
    showMenu();
  });
}

window.addEventListener('beforeunload', () => {
  localStorage.setItem('futpadel:name', session.name);
});

showMenu();
