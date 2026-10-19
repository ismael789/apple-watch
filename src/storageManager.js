/* eslint-disable import/no-unresolved, no-await-in-loop */

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import WatchStorage from '../modules/watch-storage';
import { readStored, writeStored } from './storage';

const documentRoot = FileSystem.documentDirectory;
const cacheRoot = FileSystem.cacheDirectory;

if (!documentRoot || !cacheRoot) {
  throw new Error('El almacenamiento local no está disponible.');
}

const INTERNAL_DIRECTORIES = {
  photos: `${documentRoot}photos/`,
  music: `${documentRoot}music/`,
  downloads: `${documentRoot}downloads/`,
  other: `${documentRoot}other/`,
  cache: `${cacheRoot}watch-home/`,
};

let privateDirectories = { ...INTERNAL_DIRECTORIES };
let nativeEnvironment = null;
let initializationPromise = null;

const PERSISTENT_KINDS = ['photos', 'music', 'downloads', 'other'];
const SAFETY_MARGIN = 1024 * 1024;

const configuredApplicationId =
  (Constants.expoConfig && Constants.expoConfig.android
    ? Constants.expoConfig.android.package
    : null) || null;

const managedRoots = () => [
  ...new Set([
    ...Object.values(privateDirectories),
    ...Object.values(INTERNAL_DIRECTORIES),
  ]),
];

export const initializePrivateStorage = async () => {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    if (!WatchStorage) return getStorageEnvironment();

    const result = await WatchStorage.initializeAsync();
    nativeEnvironment = result;
    if (
      configuredApplicationId &&
      result.applicationId !== configuredApplicationId
    ) {
      throw new Error(
        `El applicationId nativo ${result.applicationId} no coincide con ${configuredApplicationId}.`,
      );
    }

    const external = result.externalFiles;
    const directories = external && external.directories;
    if (
      external &&
      external.available &&
      external.initialized &&
      directories &&
      PERSISTENT_KINDS.every(kind => directories[kind])
    ) {
      privateDirectories = {
        photos: directories.photos,
        music: directories.music,
        downloads: directories.downloads,
        other: directories.other,
        cache: INTERNAL_DIRECTORIES.cache,
      };
    }
    return getStorageEnvironment();
  })().catch(error => {
    initializationPromise = null;
    throw error;
  });
  return initializationPromise;
};

const safeName = value => {
  const cleaned = String(value || 'archivo')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(-90);
  return cleaned || 'archivo';
};

const uniqueName = originalName =>
  `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}-${safeName(originalName)}`;

const fileSize = info =>
  info && info.exists && typeof info.size === 'number' ? info.size : null;

export const ensurePrivateDirectories = async () => {
  await initializePrivateStorage();
  const directories = Object.values(privateDirectories);
  for (let index = 0; index < directories.length; index += 1) {
    await FileSystem.makeDirectoryAsync(directories[index], {
      intermediates: true,
    });
  }
};

export const isManagedFile = uri =>
  typeof uri === 'string' && managedRoots().some(root => uri.startsWith(root));

export const copyIntoPrivateStorage = async ({
  sourceUri,
  kind,
  originalName,
  expectedSize,
}) => {
  if (!PERSISTENT_KINDS.includes(kind)) {
    throw new Error('Categoría privada no válida.');
  }
  if (!sourceUri) throw new Error('El archivo de origen no existe.');

  await initializePrivateStorage();
  await FileSystem.makeDirectoryAsync(privateDirectories[kind], {
    intermediates: true,
  });

  const sourceInfo = await FileSystem.getInfoAsync(sourceUri, { size: true });
  if (!sourceInfo.exists) throw new Error('El archivo de origen no existe.');
  const requestedSize =
    typeof expectedSize === 'number' ? expectedSize : fileSize(sourceInfo);
  const available = await FileSystem.getFreeDiskStorageAsync();
  if (
    typeof requestedSize === 'number' &&
    requestedSize + SAFETY_MARGIN > available
  ) {
    throw new Error('No hay espacio suficiente para guardar el archivo.');
  }

  const destination = `${privateDirectories[kind]}${uniqueName(originalName)}`;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destination });
    const copiedInfo = await FileSystem.getInfoAsync(destination, {
      size: true,
    });
    const copiedSize = fileSize(copiedInfo);
    if (!copiedInfo.exists || copiedSize === null) {
      throw new Error('No se pudo verificar la copia privada.');
    }
    if (typeof requestedSize === 'number' && copiedSize !== requestedSize) {
      throw new Error('La copia privada quedó incompleta.');
    }
    return { uri: destination, size: copiedSize };
  } catch (error) {
    await FileSystem.deleteAsync(destination, {
      idempotent: true,
    }).catch(() => {});
    throw error;
  }
};

export const deleteManagedFile = async uri => {
  await initializePrivateStorage();
  if (!isManagedFile(uri)) {
    throw new Error('Se rechazó eliminar un archivo externo a la aplicación.');
  }
  await FileSystem.deleteAsync(uri, { idempotent: true });
};

export const removeManagedTemporaryFile = async uri => {
  if (typeof uri !== 'string' || !uri.startsWith(cacheRoot)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
};

export const keepExistingManagedFiles = async uris => {
  await initializePrivateStorage();
  const candidates = Array.isArray(uris) ? uris : [];
  const results = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const uri = candidates[index];
    if (isManagedFile(uri)) {
      const info = await FileSystem.getInfoAsync(uri, {
        size: true,
      }).catch(() => ({ exists: false }));
      if (info.exists) results.push(uri);
    }
  }
  return results;
};

const directoryStats = async uri => {
  const info = await FileSystem.getInfoAsync(uri).catch(() => ({
    exists: false,
  }));
  if (!info.exists) return { bytes: 0, files: 0 };
  const entries = await FileSystem.readDirectoryAsync(uri);
  const result = { bytes: 0, files: 0 };
  for (let index = 0; index < entries.length; index += 1) {
    const child = `${uri}${entries[index]}`;
    const childInfo = await FileSystem.getInfoAsync(child, { size: true });
    if (childInfo.isDirectory) {
      const nested = await directoryStats(`${child}/`);
      result.bytes += nested.bytes;
      result.files += nested.files;
    } else {
      result.bytes += fileSize(childInfo) || 0;
      result.files += 1;
    }
  }
  return result;
};

export const getManagedStorageReport = async () => {
  await ensurePrivateDirectories();
  const photoStats = await directoryStats(privateDirectories.photos);
  const musicStats = await directoryStats(privateDirectories.music);
  const downloadStats = await directoryStats(privateDirectories.downloads);
  const otherStats = await directoryStats(privateDirectories.other);
  const cacheStats = await directoryStats(privateDirectories.cache);
  const photos = photoStats.bytes;
  const music = musicStats.bytes;
  const downloads = downloadStats.bytes;
  const other = otherStats.bytes;
  const cache = cacheStats.bytes;
  return {
    photos,
    music,
    downloads,
    other,
    cache,
    total: photos + music + downloads + other + cache,
    available: await FileSystem.getFreeDiskStorageAsync(),
    counts: {
      photos: photoStats.files,
      music: musicStats.files,
      downloads: downloadStats.files,
      other: otherStats.files,
      cache: cacheStats.files,
    },
    measuredAt: new Date().toISOString(),
  };
};

export const downloadIntoPrivateStorage = async ({ url, originalName }) => {
  if (!/^https?:\/\//i.test(String(url || ''))) {
    throw new Error('La dirección de descarga no es válida.');
  }
  await initializePrivateStorage();
  await FileSystem.makeDirectoryAsync(privateDirectories.cache, {
    intermediates: true,
  });
  const temporary = `${privateDirectories.cache}${uniqueName(originalName)}`;
  try {
    const result = await FileSystem.downloadAsync(url, temporary);
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`La descarga respondió con estado ${result.status}.`);
    }
    const copied = await copyIntoPrivateStorage({
      sourceUri: temporary,
      kind: 'downloads',
      originalName,
    });
    const record = {
      id: uniqueName('download'),
      name: safeName(originalName),
      uri: copied.uri,
      size: copied.size,
      downloadedAt: new Date().toISOString(),
    };
    const downloads = await readStored('downloads', []);
    if (!(await writeStored('downloads', [record, ...downloads]))) {
      await deleteManagedFile(record.uri);
      throw new Error('No se pudo registrar la descarga privada.');
    }
    return record;
  } finally {
    await FileSystem.deleteAsync(temporary, {
      idempotent: true,
    }).catch(() => {});
  }
};

export const getStorageEnvironment = () => ({
  runtime: WatchStorage ? 'android-native' : 'expo-go',
  configuredApplicationId,
  applicationId:
    (nativeEnvironment && nativeEnvironment.applicationId) ||
    configuredApplicationId,
  persistentDirectory:
    (nativeEnvironment && nativeEnvironment.externalFiles.uri) || documentRoot,
  androidDataDirectory:
    (nativeEnvironment && nativeEnvironment.externalFiles.uri) || null,
  androidDataAvailable: Boolean(
    nativeEnvironment && nativeEnvironment.externalFiles.available,
  ),
  androidDataInitialized: Boolean(
    nativeEnvironment && nativeEnvironment.externalFiles.initialized,
  ),
  androidObbDirectory: (nativeEnvironment && nativeEnvironment.obb.uri) || null,
  androidObbAvailable: Boolean(
    nativeEnvironment && nativeEnvironment.obb.available,
  ),
  androidObbExists: Boolean(nativeEnvironment && nativeEnvironment.obb.exists),
  androidObbInitialized: false,
});

export const formatBytes = bytes => {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
};
