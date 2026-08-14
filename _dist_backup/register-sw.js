// register-sw.js — tiny SW bootstrap for AURA Mobile
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw-mobile.js');
      // Signal ready to the app shell
      window.dispatchEvent(new CustomEvent('sw:ready', {
        detail: { scope: reg.scope }
      }));
    } catch (err) {
      console.warn('[AURA SW] registration failed:', err);
    }
  });
}
