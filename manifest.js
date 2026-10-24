/* ============================================================
 * Зеркало manifest.json для чтения версии в WebView на file://.
 * ВАЖНО: при изменении версии в manifest.json
 *        обнови version и здесь — они должны совпадать.
 * ============================================================ */
window.MANIFEST = {
  "name": "My Black Window",
  "short_name": "MBW",
  "version": "2.5",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#0F0D13",
  "theme_color": "#0F0D13"
};