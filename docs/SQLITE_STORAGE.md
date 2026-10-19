# SQLite local

Watch Home utiliza `expo-sqlite` y la base privada `watch-home.db`. En Expo Go
la ubicación pertenece a Expo Go; en una APK futura pertenecerá al paquete
`com.ismael.watchhome`. La base no se guarda en `Android/data`, `Android/obb`
ni en una biblioteca pública.

## Capas de almacenamiento

- SQLite guarda registros estructurados, preferencias y metadatos.
- AsyncStorage se conserva como copia de recuperación durante la transición.
- Las fotografías, canciones, notas de voz y descargas continúan como archivos
  privados. SQLite solo conserva sus URI y metadatos.
- `WatchStorageModule` continúa preparando las carpetas privadas de la APK.
- OBB no se utiliza para información personal ni para la base de datos.

## Tablas

La versión 1 incluye control de esquema y migración (`schema_migrations`,
`legacy_migrations`, `storage_state`), compatibilidad futura
(`key_value_store`) y tablas para las funciones existentes:

- `watch_settings`, `weather_cache` y `music_preferences`.
- `alarms`, `calendar_events`, `activity_records`, `workouts` y
  `sleep_sessions`.
- `medications`, `mindfulness_sessions`, `world_cities`,
  `handwashing_sessions`, `noise_samples` y `waypoints`.
- `photos`, `music_tracks`, `voice_memos` y `downloads`.
- `message_drafts`, `wallet_cards`, `stripe_transactions`,
  `stripe_pending_attempts` y `notes`.

Las tablas usan identificadores estables, posición para conservar el orden,
JSON parametrizado para mantener los modelos actuales, URI independiente para
archivos, fecha consultable e índices de orden/fecha. Las URI de archivos son
únicas dentro de sus bibliotecas.

## Migración y recuperación

En el primer arranque se crea el esquema, se leen las claves antiguas
`@watch-home/*` y se importan una sola vez. Cada colección se verifica contando
sus filas antes de marcarla como migrada. La información anterior no se borra.
Si SQLite no está disponible temporalmente, la aplicación puede leer y escribir
el respaldo existente y vuelve a copiarlo a SQLite cuando sea posible.

La escritura normal actualiza SQLite y AsyncStorage. Las altas de archivos
eliminan la copia física si no se puede registrar su metadata. En las bajas se
actualiza primero el catálogo y se restaura si falla la eliminación física.

## Límites de validación

El bundle confirma que la integración puede compilarse para Android. La ruta
física, persistencia tras terminar el proceso y eliminación de la base al
desinstalar deben comprobarse instalando la futura APK. Los datos creados dentro
de Expo Go no se transfieren automáticamente a esa APK.
