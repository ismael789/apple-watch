import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getDatabaseStatus,
  initializeDatabase,
  readDatabaseValue,
  writeDatabaseValue,
} from './database';

const prefix = '@watch-home/';

export const readStored = async (key, fallback) => {
  try {
    const databaseValue = await readDatabaseValue(key);
    if (databaseValue !== undefined) return databaseValue;
  } catch (error) {
    // AsyncStorage remains the recovery source if SQLite is unavailable.
  }
  try {
    const value = await AsyncStorage.getItem(`${prefix}${key}`);
    if (value === null) return fallback;
    const parsed = JSON.parse(value);
    writeDatabaseValue(key, parsed).catch(() => {});
    return parsed;
  } catch (error) {
    return fallback;
  }
};

export const writeStored = async (key, value) => {
  let sqliteSaved = false;
  let backupSaved = false;
  try {
    await writeDatabaseValue(key, value);
    sqliteSaved = true;
  } catch (error) {
    sqliteSaved = false;
  }
  try {
    await AsyncStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
    backupSaved = true;
  } catch (error) {
    backupSaved = false;
  }
  return sqliteSaved || backupSaved;
};

export const initializeStructuredStorage = initializeDatabase;
export const getStructuredStorageStatus = getDatabaseStatus;
