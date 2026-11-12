/**********************************************
 * Модуль: Иконки (SVG)
 * [FIX] init(): идемпотентный (не перезаписывает уже обработанные иконки).
 **********************************************/

modules.icons = (function() {
  const ICONS = {
    wallpaperAuto: `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>`,
    wallpaperPick: `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="2"/><path d="M3 15l4-4 3 3 6-6"/>`,
    settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,

    prev: `<path d="M6 6v12M18 7l-8 5 8 5V7z"/>`,
    play: `<path d="M9 7.5v9l7-4.5-7-4.5z"/>`,
    next: `<path d="M18 6v12M6 7l8 5-8 5V7z"/>`,

    close: `<path d="M8 8l8 8M16 8l-8 8"/>`,

    video: `<path d="M4 6h16v12H4zM10 9l5 3-5 3V9z"/>`,
    save: `<path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H6V5h9v4z"/>`
  };

  function init() {
    document.querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.iconRendered === '1') return;
      const iconName = el.getAttribute('data-icon');
      if (!ICONS[iconName]) return;

      const viewBox = el.getAttribute('viewBox') || '0 0 24 24';
      const fill = el.getAttribute('fill') || 'none';
      const stroke = el.getAttribute('stroke') || 'currentColor';
      const strokeWidth = el.getAttribute('stroke-width') || '1.8';

      el.innerHTML = ICONS[iconName];
      el.setAttribute('viewBox', viewBox);
      el.setAttribute('fill', fill);
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', strokeWidth);
      el.setAttribute('stroke-linecap', 'round');
      el.setAttribute('stroke-linejoin', 'round');
      el.dataset.iconRendered = '1';
    });
  }

  return { init };
})();