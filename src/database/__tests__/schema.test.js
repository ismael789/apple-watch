/* eslint-env jest */

import {
  COLLECTIONS,
  LEGACY_KEYS,
  migrationOneSql,
  migrationThreeSql,
  normalizeRecords,
} from '../schema';

describe('esquema SQLite del reloj', () => {
  test('incluye todas las claves persistentes conocidas sin repetir tablas', () => {
    expect(LEGACY_KEYS).toEqual(
      expect.arrayContaining([
        'alarms',
        'photos',
        'musicLibrary',
        'gameTicTacToe',
        'gameMinesweeper',
        'reminders',
        'reminderLists',
        'shortcuts',
        'appOrder',
      ]),
    );
    const tables = Object.values(COLLECTIONS).map(config => config.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  test('la migración 3 agrega funciones nuevas sin recrear tablas anteriores', () => {
    expect(migrationThreeSql).toContain('CREATE TABLE IF NOT EXISTS reminders');
    expect(migrationThreeSql).toContain(
      'CREATE TABLE IF NOT EXISTS reminder_lists',
    );
    expect(migrationThreeSql).toContain('CREATE TABLE IF NOT EXISTS shortcuts');
    expect(migrationThreeSql).toContain('CREATE TABLE IF NOT EXISTS app_order');
  });

  test('normaliza y elimina duplicados mediante identificadores estables', () => {
    const records = normalizeRecords('alarms', [
      { id: 'alarm-1', time: '07:00', enabled: true },
      { id: 'alarm-1', time: '08:00', enabled: false },
      { id: 'alarm-2', time: '09:00', enabled: true },
    ]);
    expect(records).toHaveLength(2);
    expect(records.map(record => record.recordId)).toEqual([
      'alarm-1',
      'alarm-2',
    ]);
    expect(records.map(record => record.position)).toEqual([0, 1]);
  });

  test('conserva referencias de archivos sin convertirlos en BLOB', () => {
    const uri = 'file:///private/photos/photo.jpg';
    const [record] = normalizeRecords('photos', [uri]);
    expect(record.uri).toBe(uri);
    expect(JSON.parse(record.payload)).toBe(uri);
  });

  test('crea control de migraciones, estado e índices', () => {
    expect(migrationOneSql).toContain(
      'CREATE TABLE IF NOT EXISTS schema_migrations',
    );
    expect(migrationOneSql).toContain(
      'CREATE TABLE IF NOT EXISTS legacy_migrations',
    );
    expect(migrationOneSql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_uri',
    );
  });
});
