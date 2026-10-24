# JCarTools Web API

Документация API для HTML-экранов JCarTools.

- HTML-версия документации: [`index.html`](./index.html)
- Разделы: [чёрный экран](#чёрный-экран), [приборная панель / HUD](#приборная-панель--hud)

## Чёрный экран

Чёрный экран работает внутри Android WebView. Со стороны JS доступен объект:

```js
window.androidApi
```

Почти все методы принимают первым аргументом токен:

```js
const TOKEN = "SECURE_TOKEN_2025";
```

После загрузки страницы нужно сообщить Android, что JS готов принимать события:

```js
window.androidApi.onJsReady(TOKEN);
```

## JS -> Android

| Метод | Возврат | Назначение |
| --- | --- | --- |
| `onJsReady(token)` | `void` | Сообщить Android, что страница готова принимать события. |
| `onClose(token)` | `void` | Закрыть чёрный экран. |
| `onSettings(token)` | `void` | Открыть настройки текущего веб-экрана. |
| `runEnum(token, enumName)` | JSON string | Запустить встроенную команду по имени. |
| `getRunEnum(token)` | JSON string | Получить список доступных команд `runEnum`. |
| `getRunEnumPic(token, enumName)` | string | Получить иконку команды в base64. |
| `runApp(token, packageName)` | JSON string | Запустить приложение по package name. |
| `getSavedSplitActions(token)` | JSON string | Получить сохранённые комбинации разделения экрана. |
| `runSavedSplit(token, raw)` | JSON string | Запустить сохранённую комбинацию из списка. |
| `requestRunAppAsync(token, requestId, packageName)` | boolean | Поставить запуск приложения в очередь; ответ приходит событием `carResponse`. |
| `requestRunEnumAsync(token, requestId, enumName)` | boolean | Асинхронно выполнить встроенную команду. |
| `requestRunSavedSplitAsync(token, requestId, raw)` | boolean | Асинхронно запустить сохранённую комбинацию разделения экрана. |
| `getUserApps(token)` | JSON string | Получить список пользовательских приложений. |
| `getAppInfo(token, packageName)` | JSON string | Получить название и иконку приложения. |
| `setvol(token, value)` | `void` | Установить громкость. |
| `getvol(token)` | number | Получить текущую media-громкость в процентах. |
| `getCarData(token, name)` | JSON string | Получить данные автомобиля по имени запроса. |
| `carCommand(token, json)` | JSON string | Выполнить JSON-команду текущего `CarCmdProxy.c(...)`. |
| `carCmd(token, json)` | JSON string | Короткий alias для `carCommand(...)`. |
| `requestCarCommandAsync(token, requestId, json)` | boolean | Поставить JSON-команду авто в очередь; ответ событием `carResponse`. |
| `requestCarDataAsync(token, requestId, name)` | boolean | Асинхронно запросить данные авто; ответ событием `carResponse`. |
| `requestLauncherCatalogAsync(token, requestId)` | boolean | Получить каталог действий, приложений и разделений частями через `launcherCatalog`. |
| `getWeather(token)` | JSON string | Получить сохранённые данные погоды. |
| `refreshWeather(token, latitude, longitude)` | JSON string | Запросить обновление погоды; результат событием `weather`. |
| `subscribeMiniMap(token)` | JSON string | Подписаться на кадры мини-карты. |
| `setMiniMapTheme(token, mode)` | JSON string | Задать тему мини-карты: `day` или `night`. |
| `unsubscribeMiniMap(token)` | JSON string | Отписаться от кадров мини-карты. |
| `getFileList(token)` | JSON string | Получить список файлов из Downloads. |
| `getFile(token, name)` | string | Получить файл из Downloads в base64. |
| `setLogFilter(token, q1, q2, q3)` | `void` | Задать до трёх фильтров для чтения строк из автомобильных логов. |
| `pingEvent(token)` | `void` | Проверить обратную отправку события в JS. |
| `setBright(token, value)` | `void` | Передать значение яркости/прозрачности `0..100`. |

## Получение данных

### Асинхронные запросы автомобиля

`requestCarDataAsync(token, requestId, name)` использует те же имена данных, что и `getCarData`. `requestCarCommandAsync(token, requestId, json)` принимает ту же JSON-строку, что и `carCommand`.

```js
const accepted = window.androidApi.requestCarDataAsync(TOKEN, "vehicle-1", "vehicle");
const commandAccepted = window.androidApi.requestCarCommandAsync(
  TOKEN, "climate-1", JSON.stringify({ cmd: "climate_get_state" })
);
```

`true` означает только приём в очередь. При `false` запрос не принят, и ждать ответа на него не следует. Используйте непустой `requestId` не длиннее 128 символов, уникальный среди незавершённых запросов. Очередь общая с асинхронными запусками приложений, действий и разделений; при недоступности связи запрос может быть отклонён.

Результат приходит событием `carResponse`: `requestId` связывает ответ с запросом, `requestType` равен `data` или `command`, `response` содержит ответ соответствующего синхронного метода. Обработчик и вызов `onJsReady(TOKEN)` должны быть готовы до запроса.

### Каталог лаунчера

`requestLauncherCatalogAsync(token, requestId)` возвращает boolean: запрос принят или отклонён. Требования к `requestId` те же: непустая строка до 128 символов, без повторения среди незавершённых запросов каталога.

Каталог приходит несколькими событиями `launcherCatalog`:

| Поле | Значение |
| --- | --- |
| `requestId` | Идентификатор запроса. |
| `section` | `actions`, `apps`, `splits`, `actionIcons`, `appIcons` или `done`. |
| `items` | Массив элементов текущей части. |
| `append` | `false`: заменить данные секции; `true`: добавить к ранее полученным. |
| `complete` | Завершена текущая секция, а не обязательно весь каталог. |
| `error` | Необязательная ошибка секции; другие секции могут загрузиться успешно. |

`actions` содержит команды в формате `getRunEnum`, `apps` — приложения в формате `getUserApps` без иконок, `splits` — сохранённые разделения в формате `getSavedSplitActions`. Иконки приходят отдельно: `actionIcons` сопоставляйте по `RunEnum`, `appIcons` — по `package`. Окончание всего запроса обозначается секцией `done`; проверяйте ошибки предыдущих секций.

`getRunEnum` также включает действия текущего автомобильного профиля с `RunEnumType: "profile"`. Передавайте полученное значение `RunEnum` в `runEnum` или `requestRunEnumAsync` без изменений. Список команд в документации не заменяет актуальный каталог устройства.

### Погода

`getWeather(token)` возвращает сохранённую погоду: `city`, `temp`, `condition`, `icon` (URL иконки). При отсутствии данных возвращается `{}`. Температура передаётся строкой; не считайте её гарантированно числовым значением.

`refreshWeather(token, latitude, longitude)` запрашивает обновление по координатам. Ответ `{"status":"requested"}` означает приём запроса, а не готовую погоду. Результат приходит событием `weather` с указанными полями; при отсутствии результата — `{"error":"unavailable"}`. Если запрос не удалось начать из-за местоположения, метод возвращает `{"error":"location_unavailable"}`. Оба метода при неверном токене возвращают `unauthorized`.

### Мини-карта

`subscribeMiniMap(token)` включает получение события `miniMapFrame` и возвращает `{"status":"subscribed"}`. Данные события: `image` — готовый data URL JPEG, `timestamp` — временная метка кадра. Подписка не гарантирует наличие кадров: требуется доступный источник мини-карты и поддерживающий её веб-экран.

В общем обработчике событий можно отобразить кадр в существующем элементе `<img id="mini-map">`:

```js
if (type === "miniMapFrame") {
  document.getElementById("mini-map").src = data.image;
}
```

`setMiniMapTheme(token, "night")` задаёт ночную тему; `"day"` — дневную. В текущей реализации любое значение, отличное от `night` без учёта регистра, выбирает дневную тему. Это отдельный формат, не `dark` / `light` события `theme`. Ответ: `{"status":"ok"}`.

Когда карта больше не нужна, вызовите `unsubscribeMiniMap(token)`; ответ — `{"status":"unsubscribed"}`. Все три метода при неверном токене возвращают `{"error":"unauthorized"}`.

### `setvol(token, value)`

Устанавливает media-громкость в процентах. `value` считается процентом `0..100`; значения ниже `0` прижимаются к `0`, выше `100` - к `100`.

```js
window.androidApi.setvol(TOKEN, 65);
```

### `getvol(token)`

Возвращает текущую media-громкость числом `0..100`. При ошибке возвращает `-1`.

```js
const volume = window.androidApi.getvol(TOKEN);
```

Пример ответа:

```json
85
```

### `getCarData(token, name)`

Возвращает JSON-строку с данными автомобиля. Метод только читает данные из `CarCmdProxy`; управляющие команды через него не выполняются.

Часть данных может приходить через универсальные JSON-команды `CarCmdProxy.c(...)`. Например, для топлива используется команда `get_fuel_percent`, если текущий автомобильный proxy её поддерживает.

Доступные имена запроса:

| `name` | Ответ |
| --- | --- |
| `all`, `state`, `car`, `carState`, `car_state` | общий снимок: `vehicle`, `heat`, `seats` |
| `vehicle`, `vehicleState`, `vehicle_state` | скорость, обороты, двигатель, температура, АКБ, топливо, водитель, люк, паркинг |
| `heat`, `heats`, `heating`, `climate` | состояния обогревов руля, лобового и заднего стекла, температура водителя и пассажира |
| `seats` | передние и задние сиденья |
| `frontSeats`, `front_seats` | передние сиденья |
| `rearSeats`, `rear_seats`, `zadSeats`, `zad_seats` | задние сиденья |
| `fuel`, `fuelPercent`, `fuel_percent`, `getFuelPercent` | уровень топлива в процентах |
| `speed`, `getSpeed` | скорость |
| `rpm`, `getRPM` | обороты двигателя |
| `engine`, `engineState`, `getstatengin` | состояние двигателя |
| `outTemp`, `out_temp`, `getouttemp` | наружная температура |
| `driverTemp`, `driver_temp` | температура водителя |
| `passengerTemp`, `passenger_temp` | температура пассажира |
| `cabinTemp`, `cabin_temp` | температура водителя и пассажира |
| `vod`, `getvod` | выбранный водитель / профиль |
| `sun`, `getsun` | состояние люка |
| `park`, `parkOnOff`, `getParkOnOff` | состояние парковочного режима |
| `battery`, `batteryVoltage`, `akbvolt` | напряжение АКБ |
| `rulHeat`, `steeringHeat`, `getrulheat` | обогрев руля |
| `lobHeat`, `windshieldHeat`, `getlobheat` | обогрев лобового стекла |
| `zadHeat`, `rearHeat`, `getzadheat` | обогрев заднего стекла |

```js
const car = JSON.parse(
  window.androidApi.getCarData(TOKEN, "all")
);
```

Пример ответа для `all`:

```json
{
  "name": "all",
  "vehicle": {
    "name": "vehicle",
    "speed": 42,
    "rpm": 1200,
    "engine": true,
    "outTemp": 18,
    "batteryVoltage": 12.4,
    "fuelPercent": 75.3,
    "fuelPercentRaw": 753,
    "vod": 1,
    "sun": false,
    "park": false
  },
  "heat": {
    "name": "heat",
    "rulHeat": true,
    "lobHeat": false,
    "zadHeat": false,
    "driverTemp": 22.0,
    "passengerTemp": 22.5
  },
  "seats": {
    "name": "seats",
    "front": {
      "name": "frontSeats",
      "frontLeft": {
        "seat": 1,
        "heat": 2,
        "vent": 0
      },
      "frontRight": {
        "seat": 2,
        "heat": 0,
        "vent": 1
      }
    },
    "rear": {
      "name": "rearSeats",
      "rearLeft": {
        "seat": 0,
        "heat": 1,
        "vent": 2
      },
      "rearRight": {
        "seat": 1,
        "heat": 0,
        "vent": 1
      }
    }
  }
}
```

Старый формат `frontSeats` сохранён:

```js
const seats = JSON.parse(
  window.androidApi.getCarData(TOKEN, "frontSeats")
);
```

```json
{
  "name": "frontSeats",
  "frontLeft": {
    "seat": 1,
    "heat": 2,
    "vent": 0
  },
  "frontRight": {
    "seat": 2,
    "heat": 0,
    "vent": 1
  }
}
```

Задние сиденья можно запросить отдельно:

```js
const rearSeats = JSON.parse(
  window.androidApi.getCarData(TOKEN, "rearSeats")
);
```

```json
{
  "name": "rearSeats",
  "rearLeft": {
    "seat": 0,
    "heat": 1,
    "vent": 2
  },
  "rearRight": {
    "seat": 1,
    "heat": 0,
    "vent": 1
  }
}
```

Где:

| Поле | Значение |
| --- | --- |
| `seat: 0` | левое заднее сиденье |
| `seat: 1` | левое / водительское переднее сиденье или правое заднее сиденье, зависит от блока ответа |
| `seat: 2` | правое / пассажирское переднее сиденье |
| `heat` | текущий уровень подогрева |
| `vent` | текущий уровень вентиляции |

Для сидений уровни обычно возвращаются числом `0..4` или `1..4`, в зависимости от конкретного автомобильного proxy. Если proxy не поддерживает getter, приходит default-значение `0`.

Температуру водителя и пассажира можно получить одним запросом:

```js
const cabinTemp = JSON.parse(
  window.androidApi.getCarData(TOKEN, "cabinTemp")
);
```

```json
{
  "name": "cabinTemp",
  "driverTemp": 22.0,
  "passengerTemp": 22.5
}
```

Для одиночных значений возвращается объект с полями `name` и `value`:

```js
const speed = JSON.parse(
  window.androidApi.getCarData(TOKEN, "speed")
);
```

```json
{
  "name": "speed",
  "value": 42
}
```

Уровень топлива можно получить отдельным запросом:

```js
const fuel = JSON.parse(
  window.androidApi.getCarData(TOKEN, "fuel")
);
```

```json
{
  "command": "get_fuel_percent",
  "success": true,
  "raw": 753,
  "value": 75.3,
  "percent": 75.3,
  "unit": "%",
  "rawValues": [753],
  "name": "fuelPercent"
}
```

В текущем адаптере `raw` вычисляется как округлённое `percent * 10`, а `rawValues` содержит это же значение. Это представление для совместимости, а не гарантия исходного формата автомобильных данных. Поля `value` и `percent` уже переведены в проценты.

Для профиля `ProInfoJ` ответ также содержит `lowFuelWarningValid`, `lowFuelWarning` и `reserve`. Проверяйте `lowFuelWarningValid`: значение `false` означает, что состояние предупреждения неизвестно. Его можно запросить отдельно командой `get_low_fuel_warning`.

### `carCommand(token, json)` / `carCmd(token, json)`

Передаёт JSON-команду напрямую в текущий автомобильный proxy через `CarCmdProxy.c(JSONObject)` и возвращает JSON-ответ строкой. Метод нужен для расширяемых команд, которые не входят в стандартные getter’ы `CarCmdProxy`.

```js
const fuel = JSON.parse(
  window.androidApi.carCommand(TOKEN, JSON.stringify({
    cmd: "get_fuel_percent"
  }))
);
```

Пример ответа:

```json
{
  "command": "get_fuel_percent",
  "success": true,
  "raw": 753,
  "value": 75.3,
  "percent": 75.3,
  "unit": "%",
  "rawValues": [753]
}
```

Для Jaecoo PHEV также доступны команды режимов:

```js
window.androidApi.carCommand(TOKEN, JSON.stringify({
  cmd: "set_energy_recycle",
  value: 3
}));

window.androidApi.carCommand(TOKEN, JSON.stringify({
  cmd: "set_battery_protection",
  value: 2
}));
```

Значения:

| Команда | Значения |
| --- | --- |
| `set_energy_recycle` | `1` low, `2` medium, `3` high |
| `set_battery_protection` | `1` Initial, `2` Smart, `4` Forced |
| `get_energy_recycle` | возвращает текущий уровень рекуперации |
| `get_battery_protection` | возвращает текущий режим защиты батареи |

Если конкретный автомобильный proxy не переопределяет getter из `CarCmdProxy`, вернётся default-значение интерфейса: обычно `false`, `0` или `0f`; для наружной температуры используется `-99`, для температуры салона - `-99f`.

### Команды профиля `ProInfoJ`

Ниже перечислены команды, зарегистрированные текущим профилем `ProInfoJ`. Они вызываются через `carCommand` / `carCmd`; наличие команды в этом профиле не гарантирует её поддержку другими автомобилями или комплектациями. В примерах приведены условные данные.

Имя команды передаётся в `cmd` (также принимаются `command` и `action`). Ответ содержит `command` и `success`; данные находятся на верхнем уровне объекта. При ошибке может присутствовать `error`. Проверяйте `success` до использования данных. Успешная отправка управляющей команды не подтверждает фактическое изменение состояния: для проверки повторно запросите состояние.

```js
const state = JSON.parse(window.androidApi.carCommand(
  TOKEN, JSON.stringify({ cmd: "climate_get_state" })
));
if (state.success && state.available) {
  console.log(state.driverTemperature);
}
```

#### Климат

| Команда | Параметры |
| --- | --- |
| `climate_get_state` | Без параметров; возвращает состояние климата. |
| `climate_set_power` | `value`: boolean, питание климата. |
| `climate_set_ac` | `value`: boolean, кондиционер. |
| `climate_set_auto` | `value`: boolean, автоматический режим; требует доступного текущего состояния. |
| `climate_set_sync` | `value`: boolean, синхронизация зон. |
| `climate_set_recirculation` | `value`: boolean, рециркуляция. |
| `climate_set_fan_speed` | `value`: целое `1..10`; значение ограничивается этим диапазоном. |
| `climate_set_air_mode` | `value`: целое `0..6`; значение ограничивается этим диапазоном. |
| `climate_set_front_defrost` | `value`: boolean, обдув лобового стекла. |
| `climate_set_rear_defrost` | `value`: boolean, обогрев заднего стекла. |
| `climate_set_front_glass_heat` | `value`: boolean, обогрев лобового стекла. |
| `climate_set_steering_wheel_heat` | `value`: boolean, обогрев руля. |
| `climate_set_temperature` | `zone`: `1` водитель, `2` пассажир; `value`: температура в °C. |
| `climate_set_seat_heat` | `seat`: `1` водитель, `2` пассажир; `value`: `0..3`, где `0` — выключено. |
| `climate_set_seat_vent` | `seat`: `1` водитель, `2` пассажир; `value`: `0..3`, где `0` — выключено. |

Передавайте параметры явно. Уровни сидений ограничиваются диапазоном `0..3`; неверная зона или номер сиденья приводят к `success: false`. Для переключателей используйте JSON-значения `true` / `false`. Эти уровни сидений нормализованы и отличаются от значений getter’ов `getCarData`.

Для климатических команд сохранены варианты с префиксом `j6_`; запрос состояния также доступен как `getClimateState` и `getJ6ClimateState`.

Поля ответа `climate_get_state`:

| Поля | Формат |
| --- | --- |
| `available` | Доступна хотя бы часть основных данных климата. |
| `power`, `ac`, `auto`, `sync`, `recirculation` | boolean |
| `frontDefrost`, `rearDefrost`, `frontGlassHeat`, `steeringWheelHeat` | boolean |
| `fanSpeed` | `1..10` |
| `airMode` | `0..6` либо `-1`, если режим неизвестен. |
| `driverTemperature`, `passengerTemperature` | Температура в °C. |
| `driverSeatHeat`, `driverSeatVent`, `passengerSeatHeat`, `passengerSeatVent` | Уровень `0..3`. |

`available: true` не означает достоверность каждого поля. Для недоступных температур используется `22`, для вентилятора — `1`; некоторые другие поля получают `false` или `0`. Значения по умолчанию нельзя считать подтверждёнными измерениями.

```js
const result = JSON.parse(window.androidApi.carCommand(
  TOKEN,
  JSON.stringify({ cmd: "climate_set_temperature", zone: 1, value: 22.5 })
));
```

#### Режимы и питание

Для пар команд `get_…` / `set_…` getter возвращает `value`, setter принимает `value` и возвращает принятое значение при успехе.

| Команды | Значения |
| --- | --- |
| `get_drive_mode`, `set_drive_mode` | `0` eco, `1` normal, `2` sport. |
| `get_power_mode`, `set_power_mode` | `1` EV, `2` HEV. |
| `get_energy_recycle`, `set_energy_recycle` | `1` low, `2` medium, `3` high. |
| `get_battery_protection`, `set_battery_protection` | `1` initial, `2` smart, `4` forced. |
| `get_discharge_v2l`, `set_discharge_v2l` | `1` включено, `2` выключено; setter также принимает boolean. |
| `get_discharge_function_on` | Только чтение состояния функции разрядки. |
| `get_charge_discharge_gun_locked`, `set_charge_discharge_gun_locked` | `1` заблокирован, `2` разблокирован; setter также принимает boolean. |

#### Кузов и приборная панель

Следующие команды не требуют дополнительных параметров:

| Команды | Назначение |
| --- | --- |
| `open_trunk`, `close_trunk` | Открыть / закрыть багажник. |
| `open_windows_full`, `open_windows_10`, `open_windows_50`, `close_windows` | Все окна: полное открытие, 10%, 50% или закрытие. |
| `open_window_front_left_full`, `open_window_front_right_full`, `open_window_rear_left_full`, `open_window_rear_right_full` | Полностью открыть выбранное окно. |
| `open_window_front_left_10`, `open_window_front_right_10`, `open_window_rear_left_10`, `open_window_rear_right_10` | Открыть выбранное окно на 10%. |
| `parking_sensors_on` | Включить парковочные датчики. |
| `disable_qnx_vignette`, `enable_qnx_vignette` | Отключить / включить штатную навигационную виньетку приборной панели. |

#### Дополнительные данные

| Команда | Поля успешного ответа |
| --- | --- |
| `get_fuel_percent` | `value`, `percent`, `unit`, а также признаки предупреждения о низком уровне топлива. |
| `get_low_fuel_warning` | `value`: `0` / `1`; `active`, `lowFuelWarning`, `reserve`: boolean. |
| `get_turn_signals` | `left`, `right`: boolean; `leftValue`, `rightValue`: `0` / `1`; `leftValid`, `rightValid`. |
| `get_left_turn_signal`, `get_right_turn_signal` | `value`: `0` / `1`; `active`: boolean; `side`: `left` / `right`. |
| `get_high_beam` | `value`: `0` / `1`; `active`, `highBeam`: boolean. |

Неизвестная команда возвращает `success: false` и `error: "Unknown command"`. Недоступные данные также могут приводить к `success: false`; не подменяйте их достоверным нулём или выключенным состоянием.

### `getUserApps(token)`

Возвращает JSON-массив пользовательских приложений.

```js
const apps = JSON.parse(window.androidApi.getUserApps(TOKEN));
```

Пример ответа:

```json
[
  {
    "name": "Навигатор",
    "package": "ru.yandex.yandexnavi",
    "icon": "iVBORw0KGgo..."
  },
  {
    "name": "Музыка",
    "package": "com.example.music",
    "icon": "iVBORw0KGgo..."
  }
]
```

### `getAppInfo(token, packageName)`

Возвращает JSON-строку с названием и иконкой приложения.

```js
const appInfo = JSON.parse(
  window.androidApi.getAppInfo(TOKEN, "ru.yandex.yandexnavi")
);
```

Пример ответа:

```json
{
  "name": "Навигатор",
  "icon": "iVBORw0KGgo..."
}
```

### `getRunEnum(token)`

Возвращает JSON-массив доступных команд.

```js
const commands = JSON.parse(window.androidApi.getRunEnum(TOKEN));
```

Пример ответа:

```json
[
  {
    "RunEnum": "MEDIA_PLAY",
    "RunEnumText": "Медиа плей"
  },
  {
    "RunEnum": "MEDIA_PAUSE",
    "RunEnumText": "Медиа пауза"
  }
]
```

### `getRunEnumPic(token, enumName)`

Возвращает base64-строку иконки команды.

```js
const iconBase64 = window.androidApi.getRunEnumPic(TOKEN, "MEDIA_PLAY");
image.src = "data:image/png;base64," + iconBase64;
```

Пример ответа:

```text
iVBORw0KGgoAAAANSUhEUg...
```

### `getFileList(token)`

Возвращает JSON-массив файлов из Downloads.

```js
const files = JSON.parse(window.androidApi.getFileList(TOKEN));
```

Пример ответа:

```json
[
  {
    "name": "theme.zip",
    "size": 88340,
    "date": 1770000000000
  }
]
```

### `getFile(token, name)`

Возвращает base64-содержимое файла. Если файл не найден или токен неверный, возвращается пустая строка.

```js
const fileBase64 = window.androidApi.getFile(TOKEN, "theme.zip");
```

Пример ответа:

```text
UEsDBBQAAAAIA...
```

### Ошибки

Методы, которые возвращают JSON-строку, обычно возвращают объект с полем `error`.

```json
{
  "error": "unauthorized"
}
```

Возможные ошибки для `getCarData`:

| Ошибка | Значение |
| --- | --- |
| `unauthorized` | неверный токен |
| `empty_name` | не передано имя запроса |
| `unknown_data` | неизвестное имя запроса |
| `car_cmd_proxy_null` | данные автомобиля недоступны |

## Android -> JS

Android отправляет события в функцию:

```js
window.onAndroidEvent = function(type, data) {
  if (typeof data === "string") {
    data = JSON.parse(data);
  }
};
```

| Событие | Поля `data` | Назначение |
| --- | --- | --- |
| `musicInfo` | `PlayStat`, `SongName`, `SongArtist`, `SongAlbum`, `SongAlbumPicture`, `Trpos`, `Trdur` | Данные текущего трека. |
| `gps` | `lat`, `lon`, `speed`, `heading` | Координаты, GPS-скорость и курс. |
| `speed` | `value` | Скорость автомобиля. |
| `rpm` | `value` | Обороты двигателя. |
| `weather` | `temp`, `icon`; при обновлении также `city`, `condition` либо `error` | Погода; состав полей зависит от источника события. |
| `carResponse` | `requestId`, `requestType`, `response` | Ответ асинхронного запроса данных, команды или запуска. |
| `launcherCatalog` | `requestId`, `section`, `items`, `append`, `complete`, необязательное `error` | Часть каталога лаунчера. |
| `miniMapFrame` | `image`, `timestamp` | Кадр мини-карты после подписки. |
| `theme` | `mode` | Тема: `dark` или `light`. |
| `LogData` | `value` | Строка из автомобильного лога, найденная по фильтрам `setLogFilter(...)`. |
| `ping` | `ok` | Ответ на `pingEvent(token)`. |

### Получение данных из логов авто

Сначала задаются фильтры:

```js
window.androidApi.setLogFilter(
  TOKEN,
  "VehicleSpeed",
  "SeatHeat",
  "HVAC"
);
```

Затем подходящие строки приходят событием `LogData`:

```js
window.onAndroidEvent = function(type, data) {
  if (typeof data === "string") {
    data = JSON.parse(data);
  }

  if (type === "LogData") {
    console.log(data.value);
  }
};
```

Пример события:

```json
{
  "value": "[HVAC] SeatHeat left level=2"
}
```

## Команды `runEnum`

Команда запускается по имени:

```js
window.androidApi.runEnum(TOKEN, "MEDIA_PLAY");
```

| Группа | Имена | Описание |
| --- | --- | --- |
| Навигация интерфейса | `GO_TO_PP`, `GO_TO_GU`, `TOGGLE_GU_PP`, `TOGGLE_GU_PP_CPP`, `GO_CPP_TO_PP`, `TOGGLE_CPP_PP` | Переключение между головным устройством, приборкой, картами и штатными экранами. |
| Системные действия | `RUN_BLACK`, `OPEN_SHTORKA`, `CLOSE_SHTORKA`, `GLOBAL_BACK`, `GLOBAL_HOME`, `RUN_START_APP_MENU`, `RUN_FUN_CAR`, `SPLIT_RUN` | Чёрный экран, шторка, глобальные кнопки, меню приложений, быстрый доступ к функциям авто и разделение экрана. |
| Медиа | `MEDIA_PLAY`, `MEDIA_PAUSE`, `MEDIA_NEXT`, `MEDIA_BLACK`, `Volume_Down`, `Volume_Up` | Плей, пауза, следующий и предыдущий трек, уменьшение и увеличение громкости на 1 процент от текущей. |
| Передние сиденья | `heat_seat_l_0..3`, `heat_seat_r_0..3`, `vent_seat_l_0..3`, `vent_seat_r_0..3` | Подогрев и вентиляция водительского и пассажирского передних сидений. |
| Обогревы | `heat_wheel_on`, `heat_wheel_off`, `heat_windshield_on`, `heat_windshield_off`, `heat_rearwindow_on`, `heat_rearwindow_off` | Руль, лобовое стекло и заднее стекло. |
| Климат | `Driver_Temp_Down`, `Driver_Temp_Up`, `Passenger_Temp_Down`, `Passenger_Temp_Up` | Уменьшение и увеличение температуры водителя или пассажира на 1 от текущей. |
| Задние сиденья | `heat_zad_seat_l_0..3`, `heat_zad_seat_r_off`, `heat_zad_seat_r_1..3`, `vent_zad_seat_l_0..3`, `vent_zad_seat_r_off`, `vent_zad_seat_r_1..3` | Подогрев и вентиляция заднего левого и заднего правого сиденья. |
| Профили и прочее | `VIBOR_VODITEL`, `voditel_seat_1`, `voditel_seat_2`, `voditel_seat_3`, `VIEW_ALL_MESSAGE`, `b_fiksik_on`, `b_fiksik_off`, `RUN_APP_MORE`, `RUN_SPICH_FOCUS`, `Recirculation_On`, `Recirculation_Off` | Выбор водителя, сообщения, голосовой помощник, группа задач и рециркуляция. |

## Примеры

### Запуск приложений

`runApp(token, packageName)` запускает установленное приложение по имени пакета. Имя пакета можно взять из поля `package` ответа `getUserApps(token)`.

```js
const result = JSON.parse(
  window.androidApi.runApp(TOKEN, "ru.yandex.yandexnavi")
);
if (result.error) {
  console.error(result.error);
}
```

При успешной передаче команды возвращается `{"status":"ok"}`. Возможные ошибки: `unauthorized`, `license_required`, `app_not_found` (в том числе если у пакета нет доступной стартовой Activity). Ответ `ok` не подтверждает, что приложение уже отобразилось на экране.

Пример запуска из сохранённого слота:

```js
const app = JSON.parse(localStorage.getItem("app_slot_1"));

if (app) {
  window.androidApi.runApp(TOKEN, app.package);
}
```

### Разделение экрана

Команда `runEnum(TOKEN, "SPLIT_RUN")` доступна среди встроенных действий разделения экрана. Для запуска конкретной сохранённой пары приложений используйте `getSavedSplitActions` и `runSavedSplit`.

`getSavedSplitActions(token)` возвращает JSON-массив; если комбинаций нет, массив пустой. При ошибке вместо массива возвращается объект с полем `error`.

| Поле комбинации | Значение |
| --- | --- |
| `raw` | Строка для запуска; передавайте без изменений. |
| `label` | Название сохранённой комбинации. |
| `packageName`, `packageName2` | Пакеты первого и второго приложения. |
| `orient` | Сохранённая ориентация: `1` или `2`. |
| `ratio` | Сохранённое соотношение разделения. |
| `icon` | Иконка, если доступна; поле может отсутствовать. |

```js
const splits = JSON.parse(window.androidApi.getSavedSplitActions(TOKEN));
if (Array.isArray(splits) && splits.length > 0) {
  const result = JSON.parse(
    window.androidApi.runSavedSplit(TOKEN, splits[0].raw)
  );
  if (result.error) console.error(result.error);
}
```

Запускается только комбинация, которая всё ещё сохранена в JCarTools. Создавайте и изменяйте её в JCarTools, затем обновляйте список. Не конструируйте `raw` самостоятельно. Успешный ответ: `{"status":"ok"}`. Возможные ошибки: `unauthorized`, `license_required`, `invalid_split` (неверный формат), `split_not_found` (комбинация больше не найдена).

### Асинхронный запуск

Для запуска без ожидания выполнения в WebView используйте `requestRunAppAsync`, `requestRunEnumAsync` и `requestRunSavedSplitAsync`. Они возвращают `true`, если запрос принят в очередь, и `false`, если не принят. Это не результат запуска.

Передавайте непустой `requestId` длиной не более 128 символов, уникальный среди незавершённых запросов. Обработчик событий должен быть установлен до отправки запроса; страница должна вызвать `onJsReady(TOKEN)`.

Итог приходит через `window.onAndroidEvent` как событие `carResponse`:

| Поле | Значение |
| --- | --- |
| `requestId` | Идентификатор отправленного запроса. |
| `requestType` | Для запуска: `runApp`, `runEnum`, `runSavedSplit`; для запросов авто: `data`, `command`. |
| `response` | Ответ соответствующего метода: для запуска объект с `status` или `error`, для запросов авто — данные или результат команды. Если ответ не удалось разобрать как объект, строка. |

Добавьте обработку `carResponse` в общий обработчик страницы, сохранив обработку остальных событий:

```js
window.onAndroidEvent = function(type, data) {
  if (typeof data === "string") data = JSON.parse(data);
  if (type === "carResponse") {
    console.log(data.requestId, data.requestType, data.response);
  }
};
window.androidApi.onJsReady(TOKEN);

const accepted = window.androidApi.requestRunAppAsync(
  TOKEN, "launch-navigation-1", "ru.yandex.yandexnavi"
);
if (!accepted) console.error("Request not accepted");
```

### Обновление плеера по событию

```js
window.onAndroidEvent = function(type, data) {
  if (typeof data === "string") {
    data = JSON.parse(data);
  }

  if (type === "musicInfo") {
    document.querySelector(".title").textContent = data.SongName || "";
    document.querySelector(".artist").textContent = data.SongArtist || "";
  }
};
```

## Приборная панель / HUD

HUD-экран принимает навигационные, антирадарные и GPS-события от Android. Для запуска обмена данными экран вызывает:

```js
window.androidApi.onJsReady(TOKEN);
```

### События HUD

| Событие | Поля `data` | Назначение |
| --- | --- | --- |
| `hud` | `hudSenderType`, `aradarOn`, `naviOn`, `turnType`, `turnDist`, `remainDist`, `nextRoad`, `speedLimit` | Навигация и антирадар. `hudSenderType` определяет тип панели: `NAVI` или `ARAD`. |
| `GPSSignalQuality` | `updateSignalQuality` | Качество GPS-сигнала для индикатора на HUD. |

### Пример события NAVI

```json
{
  "hudSenderType": "NAVI",
  "aradarOn": false,
  "naviOn": true,
  "turnType": 3,
  "turnDist": 420,
  "remainDist": 8500,
  "nextRoad": "Ленина",
  "speedLimit": 60
}
```

### Пример события ARAD

```json
{
  "hudSenderType": "ARAD",
  "aradarOn": true,
  "naviOn": false,
  "turnType": 14,
  "turnDist": 70,
  "remainDist": 70,
  "nextRoad": "",
  "speedLimit": 90
}
```

### Пример качества GPS

```json
{
  "updateSignalQuality": 65
}
```

### Приём событий HUD

```js
window.onAndroidEvent = function(type, data) {
  if (type === "GPSSignalQuality") {
    updateGpsLevel(data.updateSignalQuality);
    return;
  }

  if (type === "hud") {
    updateHud(data);
  }
};
```

### Коды манёвров HUD

| Код | Манёвр |
| --- | --- |
| `2` | Поворот налево |
| `3` | Поворот направо |
| `4` | Съезд / развилка налево |
| `5` | Съезд / развилка направо |
| `6` | Резкий поворот налево |
| `7` | Резкий поворот направо |
| `8` | Разворот налево |
| `19` | Разворот направо |
| `9` | Движение прямо |
| `24` | Въезд на круговое движение |
| `55` | Выезд с кругового движения |
| `15` | Финиш маршрута |
| `49` | Паром / переправа |
| `14` | Камера / контроль |

### Уровни GPS

| Значение `updateSignalQuality` | Состояние |
| --- | --- |
| `null` / `undefined` | Индикатор скрыт |
| `< 14` | Низкий сигнал |
| `14..29` | Уровень 1 |
| `30..49` | Уровень 2 |
| `50..69` | Уровень 3 |
| `70..79` | Уровень 4 |
| `>= 80` | Уровень 5 |
