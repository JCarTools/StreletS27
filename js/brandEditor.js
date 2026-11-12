/**********************************************
 * Модуль: Редактирование надписи (длинное нажатие)
 * [FIX] Защита от отсутствия #editableBrand (элемент не существует в текущем HTML).
 *       init() корректно пропускается, если элемента нет.
 **********************************************/

modules.brandEditor = (function() {
  function init() {
    const brandEl = document.getElementById('editableBrand');
    if (!brandEl) {
      // Элемент отсутствует в HTML — модуль не инициализируется.
      return;
    }
    const modal = document.getElementById('brandEditorModal');
    const input = document.getElementById('brandTextInput');
    const saveBtn = document.getElementById('saveBrandEdit');
    const cancelBtn = document.getElementById('cancelBrandEdit');

    if (!modal || !input || !saveBtn || !cancelBtn) return;

    function showModal() {
      input.value = brandEl.textContent || '';
      modal.classList.add('open');
      input.focus();
    }

    function hideModal() {
      modal.classList.remove('open');
      input.blur();
    }

    function saveBrand() {
      const newText = input.value.trim();
      if (newText) {
        brandEl.textContent = newText;
        storage.save('brandText', newText);
      }
      hideModal();
    }

    makeLongPressable(brandEl, showModal, { delay: 700 });
    saveBtn.addEventListener('click', saveBrand);
    cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', e => { if (e.target === modal) hideModal(); });

    const savedText = storage.load('brandText');
    if (savedText) brandEl.textContent = savedText;
  }

  return { init };
})();