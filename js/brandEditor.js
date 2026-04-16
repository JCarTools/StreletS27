/**********************************************
 * Модуль: Редактирование надписи (длинное нажатие)
 **********************************************/

modules.brandEditor = (function() {
  const brandEl = document.getElementById('editableBrand');
  const modal = document.getElementById('brandEditorModal');
  const input = document.getElementById('brandTextInput');
  const saveBtn = document.getElementById('saveBrandEdit');
  const cancelBtn = document.getElementById('cancelBrandEdit');

  function showModal() { input.value = brandEl.textContent; modal.classList.add('open'); input.focus(); }
  function hideModal() {
    modal.classList.remove('open');
    input.blur();
    brandEl.style.position = 'fixed';
    brandEl.style.bottom = '0.3rem';
    brandEl.style.left = '0';
    brandEl.style.right = '0';
    brandEl.style.textAlign = 'center';
    brandEl.style.color = 'rgba(255, 255, 255, 0.25)';
    brandEl.style.fontSize = '1.8rem';
    brandEl.style.fontWeight = '300';
    brandEl.style.letterSpacing = '2px';
    brandEl.style.pointerEvents = 'auto';
    brandEl.style.zIndex = '400';
    brandEl.style.cursor = 'pointer';
    brandEl.style.userSelect = 'none';
    void brandEl.offsetHeight;
  }
  function saveBrand() {
    const newText = input.value.trim();
    if (newText) { brandEl.textContent = newText; storage.save('brandText', newText); }
    hideModal();
  }
  function init() {
    makeLongPressable(brandEl, showModal, { delay: 700 });
    saveBtn.addEventListener('click', saveBrand);
    cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', e => { if (e.target === modal) hideModal(); });
    const savedText = storage.load('brandText');
    if (savedText) brandEl.textContent = savedText;
  }
  return { init };
})();