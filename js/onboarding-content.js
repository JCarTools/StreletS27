/**********************************************
 * Модуль: Онбординг — контент шагов
 * Часть 1 из 2. Логика и spotlight — в onboarding.js.
 * [FIX] Шаг 9: подсветка .widget-wrapper вместо #widgetPlaceholder (работает и при скрытом содержимом).
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
      case 9: return '#networkWidgetWrapper'; // FIX: обёртка всегда в DOM, даже если widgetPlaceholder скрыт
      case 10: return '#widgetWeather';
      case 11: return '.right-buttons';
      case 12: return '#sidebar';
      case 13: return '#btnSettings';
      default: return null;
    }
  }

  return { getStepContent, getStepHighlightSelector };
})();