/* eslint-env jest */

import ionicons from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';

import { WATCH_APPS } from '../watchApps';

const ORIGINAL_APP_IDS = [
  'activity',
  'heart',
  'workout',
  'messages',
  'phone',
  'weather',
  'music',
  'maps',
  'timer',
  'alarm',
  'calendar',
  'camera',
  'photos',
  'wallet',
  'compass',
  'settings',
  'sleep',
  'find',
  'stopwatch',
];

const ADDED_APP_IDS = [
  'flashlight',
  'reminders',
  'now-playing',
  'shortcuts',
  'walkie-talkie',
  'voice-memos',
  'calculator',
  'notes',
  'world-clock',
  'mindfulness',
  'noise',
  'medications',
  'waypoints',
  'astronomy',
  'handwashing',
  'camera-remote',
  'games',
];

describe('registro de burbujas', () => {
  test('conserva las 19 aplicaciones originales', () => {
    const ids = WATCH_APPS.map(app => app.id);
    ORIGINAL_APP_IDS.forEach(id => expect(ids).toContain(id));
  });

  test('conserva todas las aplicaciones agregadas', () => {
    const ids = WATCH_APPS.map(app => app.id);
    ADDED_APP_IDS.forEach(id => expect(ids).toContain(id));
  });

  test('cada burbuja tiene identificador único y metadatos válidos', () => {
    const ids = WATCH_APPS.map(app => app.id);
    expect(WATCH_APPS).toHaveLength(36);
    expect(new Set(ids).size).toBe(WATCH_APPS.length);
    WATCH_APPS.forEach(app => {
      expect(app.name).toEqual(expect.any(String));
      expect(app.name.length).toBeGreaterThan(0);
      expect(app.icon).toEqual(expect.any(String));
      expect(app.icon.length).toBeGreaterThan(0);
      expect(ionicons[app.icon]).toBeDefined();
    });
  });
});
