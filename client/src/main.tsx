import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerPwa } from './pwa';
import { startSocket } from './socket/lifecycle';
import { socket } from './socket/socket';
import { useGameStore } from './store/gameStore';
import { startThemeSync } from './store/themeStore';

startThemeSync();
startSocket();
registerPwa();

// Opt-in debugging handle (also used by the browser tests): localStorage['uno-party:debug'] = '1'.
// It only exposes what this player already receives from the server.
try {
  if (localStorage.getItem('uno-party:debug') === '1') Object.assign(window, { __unoParty: { store: useGameStore, socket } });
} catch {
  // storage unavailable
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
