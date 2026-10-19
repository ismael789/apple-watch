/* eslint-disable no-bitwise, no-nested-ternary */

export const DATABASE_NAME = 'watch-home.db';
export const DATABASE_VERSION = 3;

export const COLLECTIONS = Object.freeze({
  settings: { table: 'watch_settings', kind: 'single' },
  alarms: { table: 'alarms', kind: 'array' },
  events: { table: 'calendar_events', kind: 'array' },
  activity: { table: 'activity_records', kind: 'array' },
  workouts: { table: 'workouts', kind: 'array' },
  sleep: { table: 'sleep_sessions', kind: 'array' },
  weather: { table: 'weather_cache', kind: 'single' },
  medications: { table: 'medications', kind: 'array' },
  mindfulnessHistory: { table: 'mindfulness_sessions', kind: 'array' },
  worldCities: { table: 'world_cities', kind: 'array' },
  handwashingHistory: { table: 'handwashing_sessions', kind: 'array' },
  noiseHistory: { table: 'noise_samples', kind: 'array' },
  waypoints: { table: 'waypoints', kind: 'array' },
  downloads: { table: 'downloads', kind: 'array', fileBacked: true },
  photos: { table: 'photos', kind: 'array', fileBacked: true },
  musicLibrary: {
    table: 'music_tracks',
    kind: 'array',
    fileBacked: true,
  },
  musicPreferences: { table: 'music_preferences', kind: 'single' },
  messages: { table: 'message_drafts', kind: 'array' },
  walletCards: { table: 'wallet_cards', kind: 'array' },
  stripeTransactions: { table: 'stripe_transactions', kind: 'array' },
  stripePendingAttempt: {
    table: 'stripe_pending_attempts',
    kind: 'single',
  },
  voiceMemos: { table: 'voice_memos', kind: 'array', fileBacked: true },
  notes: { table: 'notes', kind: 'array' },
  reminderLists: { table: 'reminder_lists', kind: 'array' },
  reminders: { table: 'reminders', kind: 'array' },
  shortcuts: { table: 'shortcuts', kind: 'array' },
  appOrder: { table: 'app_order', kind: 'array' },
  gameTicTacToe: { table: 'game_tic_tac_toe', kind: 'single' },
  gameNumPuz: { table: 'game_num_puz', kind: 'single' },
  gameBreakout: { table: 'game_breakout', kind: 'single' },
  gameMinesweeper: { table: 'game_minesweeper', kind: 'single' },
});

export const LEGACY_KEYS = Object.freeze(Object.keys(COLLECTIONS));

const hashText = text => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const firstValue = (item, keys) => {
  if (!item || typeof item !== 'object') return null;
  for (let index = 0; index < keys.length; index += 1) {
    const value = item[keys[index]];
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }
  return null;
};

export const normalizeRecords = (key, value) => {
  const config = COLLECTIONS[key];
  if (!config) return [];
  const items =
    config.kind === 'array' ? (Array.isArray(value) ? value : []) : [value];
  const seen = new Set();
  return items.reduce((records, item, position) => {
    if (item === undefined) return records;
    const payload = JSON.stringify(item);
    const explicitId =
      typeof item === 'string'
        ? item
        : firstValue(item, [
            'id',
            'paymentIntentId',
            'uri',
            'timeZone',
            'createdAt',
            'date',
          ]);
    const recordId =
      config.kind === 'single'
        ? 'singleton'
        : explicitId || `${position}-${hashText(payload)}`;
    if (seen.has(recordId)) return records;
    seen.add(recordId);
    records.push({
      recordId,
      position: records.length,
      payload,
      uri:
        typeof item === 'string' && config.fileBacked
          ? item
          : config.fileBacked
          ? firstValue(item, ['uri'])
          : null,
      eventTime: firstValue(item, [
        'updatedAt',
        'createdAt',
        'date',
        'time',
        'downloadedAt',
      ]),
    });
    return records;
  }, []);
};

const tableSql = table => `
  CREATE TABLE IF NOT EXISTS ${table} (
    record_id TEXT PRIMARY KEY NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    payload TEXT NOT NULL,
    uri TEXT,
    event_time TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_${table}_position
    ON ${table} (position);
  CREATE INDEX IF NOT EXISTS idx_${table}_event_time
    ON ${table} (event_time);
`;

export const migrationOneSql = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS storage_state (
    storage_key TEXT PRIMARY KEY NOT NULL,
    item_count INTEGER NOT NULL CHECK (item_count >= 0),
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS legacy_migrations (
    storage_key TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('empty', 'imported')),
    item_count INTEGER NOT NULL CHECK (item_count >= 0),
    migrated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS key_value_store (
    storage_key TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ${Object.values(COLLECTIONS)
    .map(config => tableSql(config.table))
    .join('\n')}
  CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_uri
    ON photos (uri) WHERE uri IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_music_tracks_uri
    ON music_tracks (uri) WHERE uri IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_memos_uri
    ON voice_memos (uri) WHERE uri IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_downloads_uri
    ON downloads (uri) WHERE uri IS NOT NULL;
`;

export const migrationTwoSql = [
  'gameTicTacToe',
  'gameNumPuz',
  'gameBreakout',
  'gameMinesweeper',
]
  .map(key => tableSql(COLLECTIONS[key].table))
  .join('\n');

export const migrationThreeSql = [
  'reminderLists',
  'reminders',
  'shortcuts',
  'appOrder',
]
  .map(key => tableSql(COLLECTIONS[key].table))
  .join('\n');
