/**********************************************
 * Модуль: Конфигурация настроек (Схема)
 * Содержит схему всех доступных настроек.
 **********************************************/

modules.settingsConfig = (function() {
  const schema = {
    widgets: {
      title: 'Виджеты',
      settings: [
        { id: 'showClock', type: 'toggle', label: 'Показывать виджет часов', default: true },
        { id: 'showClimate', type: 'toggle', label: 'Показывать виджет климата', default: true },
        { id: 'showApps', type: 'toggle', label: 'Показывать виджет приложений', default: true },
        { id: 'showWeather', type: 'toggle', label: 'Показывать виджет погоды', default: false },
        { id: 'showMiniMap', type: 'toggle', label: 'Показывать виджет мини-карты', default: false },
        { id: 'showPlayer', type: 'toggle', label: 'Показывать виджет плеера', default: true },
		{ id: 'showNetworkStatus', type: 'toggle', label: 'Показывать виджет данных (топливо/АКБ/сеть)', default: true },
		{ id: 'miniMapTheme', type: 'select', label: 'Тема мини-карты', options: ['День', 'Ночь', 'Авто'], default: 'Ночь' },
        { id: 'widgetSize', type: 'range', label: 'Размер виджетов', min: 9, max: 20, step: 0.5, default: 13.5, unit: 'rem' },
        { id: 'widgetOpacity', type: 'range', label: 'Прозрачность виджетов и кнопок', min: 0.3, max: 1, step: 0.01, default: 1, unit: '' },
        { id: 'widgetBlur', type: 'range', label: 'Размытие фона', min: 0, max: 20, step: 1, default: 10, unit: 'px' },
        { id: 'widgetBottomMargin', type: 'range', label: 'Отступ виджетов снизу', min: 0, max: 5, step: 0.1, default: 0.5, unit: 'rem' }
      ]
    },
    climate: {
      title: 'Климат',
      settings: [
        { id: 'climateOffButton', type: 'toggle', label: 'Кнопка выключения всех устройств', default: true },
        { id: 'climateSlotsCount', type: 'select', label: 'Количество кнопок устройств', options: ['4', '6', '8'], default: '6' },
        { id: 'climateIconColor', type: 'select', label: 'Цвет иконок в кнопках', options: ['Белый', 'Черный'], default: 'Белый' },
        { id: 'showClimateTemp', type: 'toggle', label: 'Свайп-регулировка температуры', default: true },
        { id: 'climateTempOpacity', type: 'range', label: 'Прозрачность цифр температуры', min: 0.1, max: 1, step: 0.05, default: 0.4, unit: '' },
        { id: 'climateTempFontSize', type: 'range', label: 'Размер шрифта температуры', min: 4, max: 8, step: 0.5, default: 8, unit: 'rem' }
      ]
    },
    fuel: {
      title: 'Настройка бака',
      settings: [
        { id: 'fuelTankSize', type: 'text', label: 'Размер бака (литров)', default: '60', placeholder: 'Например, 60' },
        { id: 'fuelDisplayMode', type: 'select', label: 'Показывать остаток', options: ['Проценты', 'Литры'], default: 'Проценты' }
      ]
    },
    clock: {
      title: 'Часы',
      settings: [
        { id: 'showClockWeather', type: 'toggle', label: 'Показывать температуру в часах', default: true },
        { id: 'showDate', type: 'toggle', label: 'Показывать дату', default: true },
        { id: 'showWeekday', type: 'toggle', label: 'Показывать день недели', default: true },
        { id: 'nightModeOnClockTap', type: 'toggle', label: 'Ночной режим по нажатию на часы', default: true }
      ]
    },
    player: {
      title: 'Плеер',
      settings: [
        { id: 'playerVolumeStep', type: 'range', label: 'Шаг изменения громкости', min: 1, max: 20, step: 1, default: 5, unit: '%' },
        { id: 'autoRequestMusicState', type: 'toggle', label: 'Автоматический запрос статуса', default: true },
        { id: 'volumeSwipeEnabled', type: 'toggle', label: 'Горизонтальный свайп по экрану → регулировка звука', default: true }
      ]
    },
    apps: {
      title: 'Приложения',
      settings: [
        { id: 'appsSlotsCount', type: 'select', label: 'Количество слотов приложений', options: ['2', '4', '6'], default: '4' },
        { id: 'showAppLabels', type: 'toggle', label: 'Показывать названия приложений', default: false }
      ]
    },
    behavior: {
      title: 'Поведение',
      settings: [
        { id: 'tapToChangeWallpaper', type: 'toggle', label: 'Тап по фону → смена обоев', default: true },
        { id: 'doubleTapToHideWidgets', type: 'toggle', label: 'Двойной тап по фону → скрыть виджеты', default: false },
        { id: 'onboardingReset', type: 'button', label: '🎓 Пройти обучение повторно', value: 'Запустить' }
      ]
    },
    offMode: {
      title: 'Черная заставка OFF-mode',
      settings: [
        { id: 'offModeHideClimate', type: 'toggle', label: 'Скрывать климат в OFF-mode', default: true },
        { id: 'offModeHideApps', type: 'toggle', label: 'Скрывать приложения в OFF-mode', default: true },
        { id: 'offModeHidePlayer', type: 'toggle', label: 'Скрывать плеер в OFF-mode', default: true },
        { id: 'offModeHideNetwork', type: 'toggle', label: 'Скрывать виджет сети и данных', default: true },
        { id: 'offModeHideMiniMap', type: 'toggle', label: 'Скрывать мини-карту в OFF-mode', default: true },
        { id: 'offModeHideRightButtons', type: 'toggle', label: 'Скрывать правые кнопки в OFF-mode', default: true }
      ]
    },
    about: {
      title: 'О панели',
      settings: [
        { id: 'version', type: 'info', label: 'Версия', value: '' },
        { id: 'author', type: 'info', label: 'Автор', value: 'Александр Стрелец' },
        { id: 'qrCode', type: 'qr' }
      ]
    }
  };

  return { schema };
})();