/**********************************************
 * Модуль: Онбординг — контент шагов
 * Часть 1 из 2. Логика и spotlight — в onboarding.js.
 * [NEW] Подробное обучение по всем виджетам и настройкам.
 * [FIX] Шаг 8 — подсветка часов (.widget_time) вместо шестерёнки.
 * [FIX 2.4] Убраны inline onclick. Кнопки получают data-action="skip"/"next"
 *       и классы .onboarding-btn-skip / .onboarding-btn-next.
 *       Обработчики навешиваются в onboarding.js через addEventListener
 *       после вставки innerHTML (CSP-friendly, без глобального modules.onboarding).
 **********************************************/

modules.onboardingContent = (function() {
  function getStepContent(step) {
    switch (step) {
      case 1:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🚗</span> Добро пожаловать!
          </div>
          <div style="margin-bottom: 1rem; color: rgba(238,242,247,0.85); line-height: 1.6;">
            Это <strong>Strelets27</strong> — ваша персональная приборная панель. 
            Она объединяет управление климатом, музыкой, приложениями, навигацией и обоями в одном стильном интерфейсе.
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
              <div class="onboarding-feature-icon">📌</div>
              <div class="onboarding-feature-text">
                <strong>Долгое нажатие</strong>
                Зажмите любую кнопку климата, чтобы <strong>заменить её</strong> на другую функцию.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">✖️</div>
              <div class="onboarding-feature-text">
                <strong>Центральная кнопка</strong>
                Выключает все активные функции климата разом.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">⚙️</div>
              <div class="onboarding-feature-text">
                <strong>Настройка</strong>
                В <strong>Настройках → Климат</strong> можно изменить количество кнопок (4, 6 или 8), цвет иконок и размер шрифта.
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
                Показывает текущую позицию композиции.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🔊</div>
              <div class="onboarding-feature-text">
                <strong>Громкость</strong>
                Встроенный ползунок. А ещё — <strong>свайп влево/вправо по свободному месту экрана</strong> быстро меняет громкость.
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
            Фон панели — это интерактивная зона. Обои можно ставить из интернета (автосмена) или выбирать из своих.
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">👆</div>
              <div class="onboarding-feature-text">
                <strong>Обычный клик</strong>
                Меняет обои на следующие из вашего плейлиста или подгружает новые из интернета (если включён режим автосмены).
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
              <div class="onboarding-feature-icon">↔️</div>
              <div class="onboarding-feature-text">
                <strong>Свайп по фону</strong>
                Быстрое управление громкостью. Проведите пальцем влево или вправо в любом свободном месте экрана.
                <div style="margin-top: 0.5rem; display: flex; justify-content: center;">
                  <div style="display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.8rem; background: rgba(100,150,255,0.12); border-radius: 0.8rem; border: 1px solid rgba(100,150,255,0.25);">
                    <span style="font-size: 1.2rem;">👆</span>
                    <span style="font-size: 1.4rem; color: #7BA7FF; letter-spacing: 0.1em;">⟶⟶⟶</span>
                    <span style="font-size: 0.7rem; color: rgba(200,220,255,0.85);">громкость +</span>
                  </div>
                </div>
                <div style="margin-top: 0.3rem; display: flex; justify-content: center;">
                  <div style="display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.8rem; background: rgba(100,150,255,0.12); border-radius: 0.8rem; border: 1px solid rgba(100,150,255,0.25);">
                    <span style="font-size: 1.4rem; color: #7BA7FF; letter-spacing: 0.1em;">⟵⟵⟵</span>
                    <span style="font-size: 1.2rem;">👆</span>
                    <span style="font-size: 0.7rem; color: rgba(200,220,255,0.85);">громкость −</span>
                  </div>
                </div>
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
              <div class="onboarding-feature-icon">⚙️</div>
              <div class="onboarding-feature-text">
                <strong>Включение виджета</strong>
                По умолчанию виджет приложений скрыт. Включите его в <strong>Настройках → Виджеты → «Показывать виджет приложений»</strong>.
              </div>
            </div>
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
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">⚙️</div>
              <div class="onboarding-feature-text">
                <strong>Количество слотов</strong>
                В <strong>Настройках → Приложения</strong> можно выбрать 2, 4 или 6 слотов.
              </div>
            </div>
          </div>
        `;
      case 7:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">↔️</span> Ориентация и перестановка виджетов
          </div>
          <div style="margin-bottom: 1rem; color: rgba(238,242,247,0.85); line-height: 1.6;">
            Панель поддерживает два профиля раскладки:
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">↔️</div>
              <div class="onboarding-feature-text">
                <strong>Горизонтальный</strong>
                Виджеты в один ряд, как лента. Удобно для горизонтальных экранов 15.6".
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">↕️</div>
              <div class="onboarding-feature-text">
                <strong>Вертикальный</strong>
                Виджеты в два независимых ряда внизу экрана. Удобно для портретной ориентации.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🤏</div>
              <div class="onboarding-feature-text">
                <strong>Перестановка</strong>
                Зажмите виджет на ~1 секунду и перетащите влево/вправо. В портретном профиле можно переносить между рядами.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">⚙️</div>
              <div class="onboarding-feature-text">
                <strong>Смена профиля</strong>
                В <strong>Настройках → Поведение → «Ориентация экрана»</strong> можно переключить профиль в любой момент.
              </div>
            </div>
          </div>
        `;
      case 8:
        return `
          <div class="onboarding-title">
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🕰️</span> Часы и Ночной режим
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
                <strong>Ночной режим (OFF-mode)</strong>
                Клик по часам активирует «Черную заставку».
                В этом режиме можно скрывать лишние виджеты (климат, плеер, приложения и др.) через
                <strong>Настройки → Черная заставка OFF-mode</strong>.
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
                <strong>Топливо</strong>
                Показывает остаток топлива в литрах или процентах. Размер бака настраивается.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🔋</div>
              <div class="onboarding-feature-text">
                <strong>АКБ</strong>
                Показывает напряжение аккумулятора. Красным — если ниже нормы.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">💾</div>
              <div class="onboarding-feature-text">
                <strong>Свободное место</strong>
                Показывает остаток свободного места на диске в ГБ.
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
            <span style="font-size: 1.6rem; margin-right: 0.5rem;">🌤️</span> Погода и мини-карта
          </div>
          <div class="onboarding-feature-list">
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🌡️</div>
              <div class="onboarding-feature-text">
                <strong>Погода</strong>
                Показывает текущую температуру, условия и влажность. По умолчанию виджет скрыт — включите в
                <strong>Настройках → Виджеты → «Показывать виджет погоды»</strong>.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🗺️</div>
              <div class="onboarding-feature-text">
                <strong>Мини-карта</strong>
                Отображает фрагмент навигации. Клик по карте запускает навигатор.
                <div style="margin-top: 0.5rem; padding: 0.6rem 0.8rem; background: rgba(255, 200, 100, 0.1); border-radius: 0.6rem; border: 1px solid rgba(255, 200, 100, 0.25); font-size: 0.8rem; color: rgba(255, 220, 160, 0.9);">
                  ⚠️ Для работы мини-карты должен быть установлен <strong>Яндекс Навигатор (мод из JCTstore)</strong>.
                </div>
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
                Включение/выключение автосмены обоев. Если включена — обои подгружаются из интернета.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">🎨</div>
              <div class="onboarding-feature-text">
                <strong>Средняя кнопка</strong>
                Открывает сайдбар с ручным выбором обоев из встроенных, ваших или «Камин HD».
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">⚙️</div>
              <div class="onboarding-feature-text">
                <strong>Нижняя кнопка</strong>
                Открывает модальное окно настроек со всеми параметрами.
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
                Раскройте «гармошку», чтобы выбрать интервал смены обоев и серверы.
              </div>
            </div>
            <div class="onboarding-feature-item">
              <div class="onboarding-feature-icon">☑️</div>
              <div class="onboarding-feature-text">
                <strong>Серверы</strong>
                Поставьте галочки на нужных источниках (Пейзажи, Автомобили, Бинг, Животные и др.).
                Затем нажмите <strong>«Проверить все серверы»</strong> — панель покажет ✅ или ❌ для каждого.
                <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.4rem; font-size: 0.75rem;">
                  <span style="padding: 0.2rem 0.5rem; background: rgba(100,200,120,0.15); border: 1px solid rgba(100,200,120,0.3); border-radius: 0.4rem; color: rgba(160,240,180,0.9);">✅ доступен</span>
                  <span style="padding: 0.2rem 0.5rem; background: rgba(255,100,100,0.15); border: 1px solid rgba(255,100,100,0.3); border-radius: 0.4rem; color: rgba(255,150,150,0.9);">❌ недоступен</span>
                </div>
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
                Нажмите «Управление обоями», чтобы загрузить картинки из папки Downloads.
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
                <strong>Любой виджет можно включить или выключить</strong> (часы, климат, плеер, приложения, погода, компас, мини-карта, данные). Также здесь — размер, прозрачность и размытие.
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
                Отображение даты, погоды, ночной режим, реакция на тапы.
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
          </div>
          <div class="onboarding-hint" style="margin-bottom: 1rem;">
            <span style="margin-right: 0.4rem;">🎓</span>
            <strong>Обучение можно пройти повторно в любой момент:</strong> откройте
            <strong>Настройки → Поведение → «🎓 Пройти обучение повторно» → «Запустить»</strong>.
            Онбординг запустится заново, и вы сможете освежить все инструкции.
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
      case 6: return '#btnSettings';
      case 7: return '.dashboard';
      case 8: return '.widget_time';        // часы на столе (включены по умолчанию)
      case 9: return '#networkWidgetWrapper';
      case 10: return '#btnSettings';
      case 11: return '.right-buttons';
      case 12: return '#sidebar';
      case 13: return '#btnSettings';
      default: return null;
    }
  }

  return { getStepContent, getStepHighlightSelector };
})();