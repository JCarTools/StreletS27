/**********************************************
 * Модуль: Онбординг (Обучающие экраны)
 * [FIX] Окно поднято выше.
 * [NEW] Автосохранение статуса прохождения (onboarding_completed).
 * [NEW] Название панели изменено на Strelets27 в первом шаге.
 * [NEW] Реализован эффект Spotlight (подсветка элементов при рассказе).
 * [NEW] Онбординг расширен до 14 шагов.
 * [NEW] Обновлён текст 7-го шага (все виджеты теперь перетаскиваются).
 * [FIX] Метод init теперь принудительно сбрасывает текущий шаг и очищает DOM от старых окон.
 **********************************************/

modules.onboarding = (function() {
  let currentStep = 1;
  const TOTAL_STEPS = 14;
  const STORAGE_KEY = 'onboarding_completed';

  function getStepContent(step) {
    switch (step) {
      case 1:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🚗</span> Добро пожаловать!
          </div>
          <div style="margin-bottom: 1rem; color: rgba(238,242,247,0.85); line-height: 1.6;">
            Это <strong>Strelets27</strong> — ваша персональная приборная панель. 
            Она объединяет управление климатом, музыкой, приложениями и обоями в одном стильном интерфейсе.
          </div>
          <div class="onboarding-hint">
            <span style="margin-right: 0.4rem;">💡</span> Сейчас я подробно расскажу, как ей пользоваться. Следите за подсветкой!
          </div>
        `;
      case 2:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🌡️</span> Блок климата
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🔘</div>
              <div class="onboarding-feature-text">
                <strong>Кнопки</strong>
                Управление подогревом, вентиляцией сидений, обогревом руля и стёкол.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">➕</div>
              <div class="onboarding-feature-text">
                <strong>Пустые слоты</strong>
                Нажмите, чтобы добавить нужную функцию в свободную ячейку.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">✖️</div>
              <div class="onboarding-feature-text">
                <strong>Центральная кнопка</strong>
                Выключает все активные функции климата разом.
              </div>
            </div>
          </div>
        `;
      case 3:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">👆</span> Температура свайпом
          </div>
          <div style="margin-bottom: 1rem; color: rgba(238,242,247,0.85); line-height: 1.6;">
            По краям экрана (на фоне) находятся невидимые зоны для быстрой регулировки температуры.
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">↕️</div>
              <div class="onboarding-feature-text">
                <strong>Свайп вверх/вниз</strong>
                Проведите пальцем по левому или правому краю экрана, чтобы изменить температуру.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">👆</div>
              <div class="onboarding-feature-text">
                <strong>Клик по цифрам</strong>
                Открывает карусель (колесо) для точной настройки температуры.
              </div>
            </div>
          </div>
        `;
      case 4:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🎵</span> Музыкальный плеер
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">⏯️</div>
              <div class="onboarding-feature-text">
                <strong>Управление</strong>
                Кнопки переключения треков и паузы.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">📊</div>
              <div class="onboarding-feature-text">
                <strong>Полоса трека</strong>
                Перемотка текущей композиции (можно тащить пальцем).
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🔊</div>
              <div class="onboarding-feature-text">
                <strong>Громкость</strong>
                Встроенный ползунок для быстрой регулировки звука.
              </div>
            </div>
          </div>
        `;
      case 5:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🖼️</span> Управление фоном
          </div>
          <div style="margin-bottom: 1rem; color: rgba(238,242,247,0.85); line-height: 1.6;">
            Фон панели — это интерактивная зона.
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">👆</div>
              <div class="onboarding-feature-text">
                <strong>Обычный клик</strong>
                Мгновенно меняет обои на следующие из вашего плейлиста (если включен ручной режим) или меняет автообои.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">📌</div>
              <div class="onboarding-feature-text">
                <strong>Долгое нажатие</strong>
                Зажмите фон на секунду, чтобы <strong>сохранить текущую картинку</strong> в список «Ваших обоев».
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🎵</div>
              <div class="onboarding-feature-text">
                <strong>Свайп по фону</strong>
                Быстрое управление громкостью. Проведите пальцем влево или вправо в любом свободном месте экрана.
              </div>
            </div>
          </div>
        `;
      case 6:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">📱</span> Ваши приложения
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">➕</div>
              <div class="onboarding-feature-text">
                <strong>Добавление</strong>
                Нажмите на пустой слот, чтобы выбрать приложение из списка.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">📌</div>
              <div class="onboarding-feature-text">
                <strong>Замена</strong>
                Долгое нажатие на слот с приложением — заменить его на другое.
              </div>
            </div>
          </div>
        `;
      case 7:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">↔️</span> Перестановка виджетов
          </div>
          <div style="margin-bottom: 1rem; color: rgba(238,242,247,0.85); line-height: 1.6;">
            Вы можете менять расположение элементов под себя.
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🤏</div>
              <div class="onboarding-feature-text">
                <strong>Зажмите виджет</strong>
                Удерживайте палец на любом виджете (включая климат и правые кнопки) около 1 секунды.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">↔️</div>
              <div class="onboarding-feature-text">
                <strong>Перетащите</strong>
                Двигайте виджет влево или вправо. Остальные элементы сдвинутся, освобождая место.
              </div>
            </div>
          </div>
          <div class="onboarding-hint">
            <span style="margin-right: 0.4rem;">💡</span> Вы можете перетащить любой виджет на самое начало или самый конец панели.
          </div>
        `;
      case 8:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🕰️</span> Часы и дата
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">⏱️</div>
              <div class="onboarding-feature-text">
                <strong>Время и дата</strong>
                Показывают время, день недели и число. Сверху отображается погода.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🌙</div>
              <div class="onboarding-feature-text">
                <strong>Ночной режим</strong>
                Клик по часам активирует «Черную заставку» (OFF-mode).
              </div>
            </div>
          </div>
        `;
      case 9:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">⛽</span> Данные автомобиля
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">⛽</div>
              <div class="onboarding-feature-text">
                <strong>Топливо и АКБ</strong>
                Показывает уровень топлива и напряжение аккумулятора.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🛜</div>
              <div class="onboarding-feature-text">
                <strong>Статус сети</strong>
                Клик по иконке запускает Speedtest.
                <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem; color: rgba(200, 220, 255, 0.8);">
                  <div>🔵 <strong>Синяя</strong> — Есть интернет</div>
                  <div>🔴 <strong>Красная с ободком</strong> — Ограниченный доступ</div>
                  <div>❌ <strong>Перечёркнутая</strong> — Нет сети</div>
                </div>
              </div>
            </div>
          </div>
        `;
      case 10:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🌤️</span> Погода и карта
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🌡️</div>
              <div class="onboarding-feature-text">
                <strong>Погода</strong>
                Показывает текущую температуру и условия за окном.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🗺️</div>
              <div class="onboarding-feature-text">
                <strong>Мини-карта</strong>
                Отображает фрагмент навигации. Клик по карте запускает навигатор.
              </div>
            </div>
          </div>
        `;
      case 11:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🎛️</span> Главные кнопки
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🖼️</div>
              <div class="onboarding-feature-text">
                <strong>Верхняя кнопка</strong>
                Включение/выключение автосмены обоев.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🎨</div>
              <div class="onboarding-feature-text">
                <strong>Средняя кнопка</strong>
                Открывает сайдбар с выбором обоев.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">⚙️</div>
              <div class="onboarding-feature-text">
                <strong>Нижняя кнопка</strong>
                Открывает модальное окно настроек.
              </div>
            </div>
          </div>
        `;
      case 12:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🖼️</span> Сайдбар обоев
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">⚙️</div>
              <div class="onboarding-feature-text">
                <strong>Настройки автосмены</strong>
                Раскройте «гармошку», чтобы выбрать интервал и серверы.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🎞️</div>
              <div class="onboarding-feature-text">
                <strong>Видео-обои</strong>
                Нажмите «Камин HD», чтобы включить анимированный фон.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">📥</div>
              <div class="onboarding-feature-text">
                <strong>Свои обои</strong>
                Нажмите «Управление обоями», чтобы загрузить картинки из Downloads.
              </div>
            </div>
          </div>
        `;
      case 13:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">⚙️</span> Настройки панели
          </div>
          <div style="margin-bottom: 1rem; color: rgba(238,242,247,0.85); line-height: 1.6;">
            Модальное окно (нижняя шестерёнка) позволяет тонко настроить панель:
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">📐</div>
              <div class="onboarding-feature-text">
                <strong>Виджеты</strong>
                Размер, прозрачность, размытие фона и отступы.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🌡️</div>
              <div class="onboarding-feature-text">
                <strong>Климат</strong>
                Количество кнопок, цвет иконок, шрифт температуры.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🕰️</div>
              <div class="onboarding-feature-text">
                <strong>Часы и поведение</strong>
                Отображение даты, погоды, ночной режим и реакция на тапы.
              </div>
            </div>
          </div>
        `;
      case 14:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🎉</span> Всё готово!
          </div>
          <div style="margin-bottom: 1rem; color: rgba(238,242,247,0.85); line-height: 1.6;">
            Теперь вы знаете все возможности панели <strong>Strelets27</strong>. 
            Если что-то забудете — настройки всегда под рукой.
          </div>
          <div class="onboarding-hint" style="margin-bottom: 1rem;">
            <span style="margin-right: 0.4rem;">💡</span> Вы можете пройти обучение заново, сбросив настройки в модальном окне (нижняя шестерёнка).
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.8rem; margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem;">
            <div style="font-size: 0.95rem; color: rgba(255, 255, 255, 0.9); text-align: center; margin-bottom: 0.5rem;">
              ❤️ Панель разработана с душой для вашего комфорта.<br>Если вам нравится <strong>Strelets27</strong>, вы можете отблагодарить автора.
            </div>
            <img src="images/Qrkod.png" alt="QR-код" style="width: 140px; height: 140px; border-radius: 0.8rem; background: white; padding: 0.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <div style="font-size: 0.85rem; color: rgba(200, 220, 255, 0.9); text-align: center;">
              Отсканируйте QR-код, чтобы поддержать создателя
            </div>
          </div>
        `;
      default:
        return `<div class="onboarding-title">Шаг ${step}</div>`;
    }
  }

  function getStepHighlightSelector(step) {
    switch (step) {
      case 2: return '.widget_climate';
      case 3: return '#climate-temp-zone-left';
      case 4: return '.widget_player';
      case 5: return 'body';
      case 6: return '.widget_apps';
      case 7: return '.dashboard';
      case 8: return '.widget_time';
      case 9: return '#widgetPlaceholder';
      case 10: return '#widgetWeather';
      case 11: return '.right-buttons';
      case 12: return '#sidebar';
      case 13: return '#btnSettings';
      default: return null;
    }
  }

  function prepareUIForStep(step) {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (step === 12) {
      if (sidebar) sidebar.classList.add('open');
      if (sidebarOverlay) sidebarOverlay.classList.add('visible');
      
      if (modules.sidebarSettings) {
        const accordion = document.querySelector('.sidebar-settings-accordion');
        if (accordion && !accordion.classList.contains('open')) {
          const toggle = document.getElementById('wmAccordionToggle');
          if (toggle) toggle.click();
        }
      }
    } else {
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
    }
  }

  function updateSpotlight(selector) {
    let mask = document.getElementById('onboardingMask');
    let ring = document.getElementById('onboardingRing');

    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'onboardingMask';
      mask.className = 'spotlight-mask';
      document.body.appendChild(mask);
    }
    if (!ring) {
      ring = document.createElement('div');
      ring.id = 'onboardingRing';
      ring.className = 'spotlight-ring';
      document.body.appendChild(ring);
    }

    if (!selector || selector === 'body') {
      mask.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      ring.style.display = 'none';
      return;
    }

    const targetEl = document.querySelector(selector);
    if (!targetEl) {
      mask.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      ring.style.display = 'none';
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    
    if (rect.width === 0 || rect.height === 0) {
      mask.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      ring.style.display = 'none';
      return;
    }

    const padding = 10;
    const x1 = rect.left - padding;
    const y1 = rect.top - padding;
    const x2 = rect.right + padding;
    const y2 = rect.bottom + padding;

    const clipPath = `polygon(
      0px 0px, 
      100% 0px, 
      100% 100%, 
      0px 100%, 
      0px 0px, 
      ${x1}px ${y1}px, 
      ${x1}px ${y2}px, 
      ${x2}px ${y2}px, 
      ${x2}px ${y1}px, 
      ${x1}px ${y1}px
    )`;

    mask.style.clipPath = clipPath;

    ring.style.display = 'block';
    ring.style.top = y1 + 'px';
    ring.style.left = x1 + 'px';
    ring.style.width = (x2 - x1) + 'px';
    ring.style.height = (y2 - y1) + 'px';
  }

  function renderStep(step) {
    prepareUIForStep(step);

    const contentHtml = getStepContent(step);
    const isLast = (step === TOTAL_STEPS);
    const nextBtnText = isLast ? 'Завершить' : 'Далее';

    let overlay = document.getElementById('onboardingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'onboardingOverlay';
      overlay.className = 'onboarding-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="onboarding-content">
        <div style="display: flex; justify-content: space-between; color: #7BA7FF; font-weight: bold; margin-bottom: 1rem;">
          <span>ШАГ ${step}</span>
          <span>ИЗ ${TOTAL_STEPS}</span>
        </div>
        
        ${contentHtml}
        
        <div class="onboarding-buttons">
          ${isLast ? '' : '<button type="button" class="modal-btn cancel" onclick="modules.onboarding.skip()">Пропустить</button>'}
          <button type="button" class="modal-btn save" onclick="modules.onboarding.next()">${nextBtnText}</button>
        </div>
      </div>
    `;

    const highlightSelector = getStepHighlightSelector(step);
    setTimeout(() => {
      updateSpotlight(highlightSelector);
    }, 400); 
  }

  function next() {
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      renderStep(currentStep);
    } else {
      close();
    }
  }

  function skip() {
    close();
  }

  function close() {
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }
    
    const mask = document.getElementById('onboardingMask');
    if (mask) mask.remove();
    
    const ring = document.getElementById('onboardingRing');
    if (ring) ring.remove();

    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('visible');

    currentStep = 1;
    storage.save(STORAGE_KEY, true);
  }

  function init() {
    // Принудительный сброс на первый шаг
    currentStep = 1;
    
    // Удаляем возможные остатки от предыдущего запуска
    const oldOverlay = document.getElementById('onboardingOverlay');
    if (oldOverlay) oldOverlay.remove();
    const oldMask = document.getElementById('onboardingMask');
    if (oldMask) oldMask.remove();
    const oldRing = document.getElementById('onboardingRing');
    if (oldRing) oldRing.remove();

    if (!storage.load(STORAGE_KEY)) {
      renderStep(currentStep);
      
      if (!window._onboardingResizeBound) {
        window._onboardingResizeBound = true;
        window.addEventListener('resize', () => {
          if (document.getElementById('onboardingOverlay')) {
            updateSpotlight(getStepHighlightSelector(currentStep));
          }
        });
      }
    }
  }

  function reset() {
    storage.remove(STORAGE_KEY);
    currentStep = 1;
    close();
  }

  return { init, next, skip, close, reset };
})();