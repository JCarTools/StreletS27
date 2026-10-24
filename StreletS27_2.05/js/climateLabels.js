/**********************************************
 * Словарь русских подписей для команд климата.
 * Используется в climate.js для formatLabel и в fallback.
 **********************************************/

const CLIMATE_LABELS = {
  heat_seat_l:          "Подогрев\nводителя",
  heat_seat_r:          "Подогрев\nпассажира",
  heat_zad_seat_l:      "Подогрев\nзад. лево",
  heat_zad_seat_r:      "Подогрев\nзад. право",
  heat_wheel_on:        "Подогрев\nруля",
  heat_windshield_on:   "Подогрев\nлобового",
  heat_rearwindow_on:   "Подогрев\nзаднего",
  vent_seat_l:          "Вентиляция\nводителя",
  vent_seat_r:          "Вентиляция\nпассажира",
  vent_zad_seat_l:      "Вентиляция\nзад. лево",
  vent_zad_seat_r:      "Вентиляция\nзад. право",
  voditel_seat_1:       "Память\nводитель 1",
  voditel_seat_2:       "Память\nводитель 2",
  voditel_seat_3:       "Память\nводитель 3",
  Recirculation_On:     "Рециркуляция"
};

function climateLabelFor(cmd) {
  if (CLIMATE_LABELS[cmd]) return CLIMATE_LABELS[cmd];
  return cmd
    .replace(/_on$/, '')
    .replace(/_/g, ' ')
    .replace(/^./, c => c.toUpperCase());
}