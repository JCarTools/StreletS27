/**********************************************
 * Модуль: Модальное окно "Сохранить обои"
 * [FIX 26] Модуль жестко задает тексты для сохранения обоев.
 **********************************************/

modules.saveWallpaperModal = (function() {
  const MODAL_ID = 'saveWallpaperModal';
  const PREVIEW_ID = 'saveWallpaperPreview';
  const TITLE_ID = 'confirmModalTitle';
  const MESSAGE_ID = 'confirmModalMessage';
  const CANCEL_ID = 'cancelSaveWallpaper';
  const CONFIRM_ID = 'confirmSaveWallpaper';
  const CLOSE_ANIM_MS = 250;

  let pendingResolve = null;
  let modal = null;
  let handlersBound = false;
  let isClosing = false;

  function close(result) {
    if (isClosing) return;
    isClosing = true;
    const resolve = pendingResolve;
    pendingResolve = null;
    if (modal) modal.classList.remove('open');
    document.body.classList.remove('confirm-modal-open');
    setTimeout(() => {
      isClosing = false;
      if (resolve) resolve(result);
    }, CLOSE_ANIM_MS);
  }

  function bindHandlers(el) {
    if (handlersBound) return;
    handlersBound = true;
    const cancelBtn = el.querySelector('#' + CANCEL_ID);
    const confirmBtn = el.querySelector('#' + CONFIRM_ID);

    function bindBtn(btn, result) {
      if (!btn) return;
      const handlePress = (e) => {
        e.preventDefault();
        e.stopPropagation();
        close(result);
      };
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('pointerup', handlePress);
      btn.addEventListener('touchend', handlePress);
      btn.addEventListener('click', handlePress);
    }

    bindBtn(cancelBtn, false);
    bindBtn(confirmBtn, true);

    el.addEventListener('click', (e) => {
      if (e.target === el) close(false);
    });
  }

  function ensureModal() {
    if (modal && document.body.contains(modal)) return modal;
    modal = document.getElementById(MODAL_ID);
    if (!modal) return null;
    bindHandlers(modal);
    return modal;
  }

  function ask() {
    return new Promise((resolve) => {
      const el = ensureModal();
      if (!el) { resolve(false); return; }

      if (pendingResolve) {
        const prev = pendingResolve;
        pendingResolve = null;
        prev(false);
      }
      pendingResolve = resolve;
      isClosing = false;

      // Жестко задаем тексты для сохранения
      const titleEl = el.querySelector('#' + TITLE_ID);
      const messageEl = el.querySelector('#' + MESSAGE_ID);
      const confirmBtn = el.querySelector('#' + CONFIRM_ID);
      
      if (titleEl) titleEl.textContent = '💾 Сохранить текущие обои?';
      if (messageEl) messageEl.textContent = 'Текущий фон будет добавлен в раздел «Ваши обои». Вы сможете выбрать его позже в сайдбаре.';
      if (confirmBtn) confirmBtn.textContent = 'Сохранить';

      const preview = el.querySelector('#' + PREVIEW_ID);
      if (preview) {
        preview.style.display = '';
        const bg = document.body.style.backgroundImage;
        if (bg && bg !== 'none' && bg.includes('url(')) {
          preview.style.backgroundImage = bg;
          preview.style.backgroundColor = '';
        } else {
          preview.style.backgroundImage = '';
          preview.style.backgroundColor = 'rgba(0,0,0,0.3)';
        }
      }

      document.body.classList.add('confirm-modal-open');
      el.classList.add('open');
    });
  }

  function destroy() {
    if (pendingResolve) {
      const prev = pendingResolve;
      pendingResolve = null;
      prev(false);
    }
    if (modal) modal.classList.remove('open');
    document.body.classList.remove('confirm-modal-open');
    handlersBound = false;
    modal = null;
    isClosing = false;
  }

  return { ask, destroy };
})();