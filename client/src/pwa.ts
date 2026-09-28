import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * registerType: 'autoUpdate' means a new service worker activates and reloads the page
 * with no prompt, as soon as one is found. The browser only checks for a new one on its
 * own roughly once a day, or on a fresh navigation — too slow for someone who installed
 * the app and left a tab open across a deploy — so we also poll explicitly.
 */
export function registerPwa(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS);
    },
  });
}
