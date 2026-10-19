/* eslint-disable no-await-in-loop */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

import {
  COLLECTIONS,
  DATABASE_NAME,
  DATABASE_VERSION,
  LEGACY_KEYS,
  migrationOneSql,
  migrationTwoSql,
  migrationThreeSql,
  normalizeRecords,
} from './schema';

const LEGACY_PREFIX = '@watch-home/';
let databasePromise = null;

const parsePayload = payload => JSON.parse(payload);

const applyMigrations = async database => {
  await database.execAsync(
    'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;',
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);',
  );
  const current = await database.getFirstAsync(
    'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations',
  );
  let version = current ? current.version : 0;
  if (version < 1) {
    await database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(migrationOneSql);
      await transaction.runAsync(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        1,
        new Date().toISOString(),
      );
    });
    version = 1;
  }
  if (version < 2) {
    await database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(migrationTwoSql);
      await transaction.runAsync(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        2,
        new Date().toISOString(),
      );
    });
    version = 2;
  }
  if (version < 3) {
    await database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(migrationThreeSql);
      await transaction.runAsync(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        3,
        new Date().toISOString(),
      );
    });
    version = 3;
  }
  if (version > DATABASE_VERSION) {
    throw new Error('La versión de la base de datos no es compatible.');
  }
};

const writeKnownValue = async (database, key, value) => {
  const config = COLLECTIONS[key];
  const records = normalizeRecords(key, value);
  const updatedAt = new Date().toISOString();
  await database.withExclusiveTransactionAsync(async transaction => {
    await transaction.runAsync(`DELETE FROM ${config.table}`);
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      await transaction.runAsync(
        `INSERT INTO ${config.table}
          (record_id, position, payload, uri, event_time, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        record.recordId,
        record.position,
        record.payload,
        record.uri,
        record.eventTime,
        updatedAt,
      );
    }
    await transaction.runAsync(
      `INSERT INTO storage_state (storage_key, item_count, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(storage_key) DO UPDATE SET
         item_count = excluded.item_count,
         updated_at = excluded.updated_at`,
      key,
      records.length,
      updatedAt,
    );
  });
  const verification = await database.getFirstAsync(
    `SELECT COUNT(*) AS count FROM ${config.table}`,
  );
  if (!verification || verification.count !== records.length) {
    throw new Error(`No se pudo verificar la colección ${key}.`);
  }
  return records.length;
};

const writeUnknownValue = async (database, key, value) => {
  await database.runAsync(
    `INSERT INTO key_value_store (storage_key, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(storage_key) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
};

const migrateLegacyData = async database => {
  for (let index = 0; index < LEGACY_KEYS.length; index += 1) {
    const key = LEGACY_KEYS[index];
    const migrated = await database.getFirstAsync(
      'SELECT status FROM legacy_migrations WHERE storage_key = ?',
      key,
    );
    if (!migrated) {
      const legacyPayload = await AsyncStorage.getItem(
        `${LEGACY_PREFIX}${key}`,
      );
      let status = 'empty';
      let itemCount = 0;
      if (legacyPayload !== null) {
        const value = parsePayload(legacyPayload);
        itemCount = await writeKnownValue(database, key, value);
        status = 'imported';
      }
      await database.runAsync(
        `INSERT OR IGNORE INTO legacy_migrations
          (storage_key, status, item_count, migrated_at)
         VALUES (?, ?, ?, ?)`,
        key,
        status,
        itemCount,
        new Date().toISOString(),
      );
    }
  }
};

export const initializeDatabase = async () => {
  if (databasePromise) return databasePromise;
  databasePromise = (async () => {
    const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await applyMigrations(database);
    await migrateLegacyData(database);
    const integrity = await database.getFirstAsync('PRAGMA quick_check(1)');
    if (!integrity || integrity.quick_check !== 'ok') {
      throw new Error('SQLite no superó la comprobación de integridad.');
    }
    return database;
  })().catch(error => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
};

export const writeDatabaseValue = async (key, value) => {
  const database = await initializeDatabase();
  if (COLLECTIONS[key]) {
    await writeKnownValue(database, key, value);
  } else {
    await writeUnknownValue(database, key, value);
  }
  return true;
};

export const readDatabaseValue = async key => {
  const database = await initializeDatabase();
  const config = COLLECTIONS[key];
  if (!config) {
    const row = await database.getFirstAsync(
      'SELECT payload FROM key_value_store WHERE storage_key = ?',
      key,
    );
    return row ? parsePayload(row.payload) : undefined;
  }
  const state = await database.getFirstAsync(
    'SELECT item_count FROM storage_state WHERE storage_key = ?',
    key,
  );
  if (!state) return undefined;
  const rows = await database.getAllAsync(
    `SELECT payload FROM ${config.table} ORDER BY position ASC`,
  );
  const values = rows.map(row => parsePayload(row.payload));
  return config.kind === 'single' ? values[0] : values;
};

export const readDatabasePage = async (key, limit = 50, offset = 0) => {
  const database = await initializeDatabase();
  const config = COLLECTIONS[key];
  if (!config || config.kind !== 'array') return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const rows = await database.getAllAsync(
    `SELECT payload FROM ${config.table}
     ORDER BY position ASC LIMIT ? OFFSET ?`,
    safeLimit,
    safeOffset,
  );
  return rows.map(row => parsePayload(row.payload));
};

export const deleteDatabaseRecord = async (key, recordId) => {
  const database = await initializeDatabase();
  const config = COLLECTIONS[key];
  if (!config || config.kind !== 'array') return false;
  const result = await database.runAsync(
    `DELETE FROM ${config.table} WHERE record_id = ?`,
    String(recordId),
  );
  return result.changes > 0;
};

export const getDatabaseStatus = async () => {
  const database = await initializeDatabase();
  const migrations = await database.getAllAsync(
    'SELECT version, applied_at FROM schema_migrations ORDER BY version',
  );
  const legacy = await database.getAllAsync(
    `SELECT storage_key, status, item_count
     FROM legacy_migrations ORDER BY storage_key`,
  );
  const foreignKeyCheck = await database.getAllAsync(
    'PRAGMA foreign_key_check',
  );
  return {
    name: DATABASE_NAME,
    path: database.databasePath,
    version: DATABASE_VERSION,
    migrations,
    legacy,
    foreignKeysValid: foreignKeyCheck.length === 0,
  };
};
