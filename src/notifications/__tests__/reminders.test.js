/* eslint-env jest */

import { reminderDate } from '../reminders';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

describe('fechas de recordatorios', () => {
  test('crea una fecha local válida', () => {
    const value = reminderDate('2030-05-16', '14:35');
    expect(value).toBeInstanceOf(Date);
    expect(value.getFullYear()).toBe(2030);
    expect(value.getMonth()).toBe(4);
    expect(value.getDate()).toBe(16);
    expect(value.getHours()).toBe(14);
    expect(value.getMinutes()).toBe(35);
  });

  test('rechaza fechas y horas imposibles', () => {
    expect(reminderDate('2030-02-30', '10:00')).toBeNull();
    expect(reminderDate('2030-05-16', '25:00')).toBeNull();
    expect(reminderDate('16/05/2030', '10:00')).toBeNull();
  });
});
