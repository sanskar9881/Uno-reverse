// Latin subsets only: the full packages ship every Korean/Devanagari subset too.
import '@fontsource/bagel-fat-one/latin.css';
import '@fontsource-variable/baloo-2/wght.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startSocket } from './socket/lifecycle';
import { socket } from './socket/socket';
import { useGameStore } from './store/gameStore';

startSocket();

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
