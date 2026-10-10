/* Applied synchronously before first paint so dark-mode users never see a light flash.
 * Kept as an external file (not inline) so the CSP can stay at script-src 'self'. */
try {
  var stored = JSON.parse(localStorage.getItem('theme') || '"system"');
  var dark = stored === 'dark' || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {
  /* localStorage blocked (private mode) — fall back to light, next-themes syncs after load */
}
