/* eslint-disable react/prop-types, import/no-unresolved, no-await-in-loop, no-nested-ternary, react/jsx-one-expression-per-line */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';

import { readStored, writeStored } from '../storage';
import {
  copyIntoPrivateStorage,
  deleteManagedFile,
  keepExistingManagedFiles,
} from '../storageManager';

const MusicContext = createContext(null);
const IS_EXPO_GO = Constants.appOwnership === 'expo';

const titleFromName = name =>
  name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');

export const MusicProvider = ({ children }) => {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [tracks, setTracks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [volume, setVolume] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    Promise.all([
      readStored('musicLibrary', []),
      readStored('musicPreferences', {
        volume: 0.8,
        shuffle: false,
        repeat: 'off',
      }),
    ]).then(async ([savedTracks, preferences]) => {
      const existingUris = await keepExistingManagedFiles(
        savedTracks.map(track => track.uri),
      );
      const validTracks = savedTracks.filter(track =>
        existingUris.includes(track.uri),
      );
      if (validTracks.length !== savedTracks.length) {
        await writeStored('musicLibrary', validTracks);
      }
      setTracks(validTracks);
      setVolume(preferences.volume);
      setShuffle(preferences.shuffle);
      setRepeat(preferences.repeat);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    player.volume = volume;
    if (hydrated) {
      writeStored('musicPreferences', { volume, shuffle, repeat });
    }
  }, [hydrated, player, repeat, shuffle, volume]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: !IS_EXPO_GO,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  const activateLockScreen = track => {
    if (!IS_EXPO_GO && player.setActiveForLockScreen) {
      player.setActiveForLockScreen(true, {
        title: track.title,
        artist: track.artist,
      });
    }
  };

  const playAt = (index, autoplay = true) => {
    const track = tracks[index];
    if (!track) return;
    setCurrentIndex(index);
    setError('');
    finished.current = false;
    player.replace(track.uri);
    if (autoplay) {
      activateLockScreen(track);
      player.play();
    }
  };

  const nextIndex = () => {
    if (!tracks.length) return -1;
    if (shuffle && tracks.length > 1) {
      let index = currentIndex;
      while (index === currentIndex)
        index = Math.floor(Math.random() * tracks.length);
      return index;
    }
    return currentIndex < tracks.length - 1 ? currentIndex + 1 : 0;
  };

  const next = () => {
    const index = nextIndex();
    if (index >= 0) playAt(index);
  };

  const previous = () => {
    if (!tracks.length) return;
    if ((status.currentTime || 0) > 3) {
      player.seekTo(0);
      return;
    }
    const index = currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;
    playAt(index);
  };

  useEffect(() => {
    if (!status.didJustFinish) {
      finished.current = false;
      return;
    }
    if (finished.current || currentIndex < 0) return;
    finished.current = true;
    if (repeat === 'one') {
      player.seekTo(0).then(() => player.play());
      return;
    }
    if (shuffle || currentIndex < tracks.length - 1 || repeat === 'all') {
      const index = nextIndex();
      if (index >= 0) playAt(index);
    }
  }, [
    currentIndex,
    player,
    repeat,
    shuffle,
    status.didJustFinish,
    tracks.length,
  ]);

  useEffect(() => {
    if (status.error) setError('No se pudo reproducir este archivo.');
  }, [status.error]);

  const togglePlayback = () => {
    if (currentIndex < 0) {
      if (tracks.length) playAt(0);
      return;
    }
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish) player.seekTo(0);
      activateLockScreen(tracks[currentIndex]);
      player.play();
    }
  };

  const seekBy = seconds =>
    player.seekTo(
      Math.max(
        0,
        Math.min(status.duration || 0, (status.currentTime || 0) + seconds),
      ),
    );

  const seekTo = seconds =>
    player.seekTo(Math.max(0, Math.min(status.duration || 0, seconds)));

  const importTracks = async () => {
    setImporting(true);
    setError('');
    const imported = [];
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      for (let index = 0; index < result.assets.length; index += 1) {
        const asset = result.assets[index];
        const copied = await copyIntoPrivateStorage({
          sourceUri: asset.uri,
          kind: 'music',
          originalName: asset.name,
          expectedSize: asset.size,
        });
        imported.push({
          id: `${Date.now()}-${index}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          uri: copied.uri,
          size: copied.size,
          title: titleFromName(asset.name),
          artist: 'Archivo local',
          filename: asset.name,
        });
      }
      const updated = [...tracks, ...imported];
      if (!(await writeStored('musicLibrary', updated))) {
        throw new Error('No se pudo registrar la biblioteca musical.');
      }
      setTracks(updated);
      if (currentIndex < 0 && imported.length) {
        const first = tracks.length;
        setCurrentIndex(first);
        player.replace(imported[0].uri);
        activateLockScreen(imported[0]);
        player.play();
      }
    } catch (importError) {
      for (let index = 0; index < imported.length; index += 1) {
        await deleteManagedFile(imported[index].uri).catch(() => {});
      }
      setError(
        importError && importError.message
          ? importError.message
          : 'No se pudo importar el audio seleccionado.',
      );
    } finally {
      setImporting(false);
    }
  };

  const toggleFavorite = async id => {
    const updated = tracks.map(track =>
      track.id === id ? { ...track, favorite: !track.favorite } : track,
    );
    setTracks(updated);
    await writeStored('musicLibrary', updated);
  };

  const deleteTrack = async id => {
    const index = tracks.findIndex(track => track.id === id);
    if (index < 0) return;
    const removed = tracks[index];
    const updated = tracks.filter(track => track.id !== id);
    if (index === currentIndex) {
      player.pause();
      player.replace(null);
      setCurrentIndex(-1);
    } else if (index < currentIndex) {
      setCurrentIndex(value => value - 1);
    }
    try {
      if (!(await writeStored('musicLibrary', updated))) {
        throw new Error('No se pudo actualizar la biblioteca musical.');
      }
      await deleteManagedFile(removed.uri);
      setTracks(updated);
    } catch (deleteError) {
      await writeStored('musicLibrary', tracks).catch(() => {});
      setError('No se pudo eliminar la copia privada de la canción.');
    }
  };

  const cycleRepeat = () =>
    setRepeat(value =>
      value === 'off' ? 'all' : value === 'all' ? 'one' : 'off',
    );

  const value = useMemo(
    () => ({
      tracks,
      currentTrack: tracks[currentIndex] || null,
      currentIndex,
      status,
      volume,
      shuffle,
      repeat,
      error,
      importing,
      playAt,
      next,
      previous,
      togglePlayback,
      seekBy,
      seekTo,
      importTracks,
      toggleFavorite,
      deleteTrack,
      setVolume,
      setShuffle,
      cycleRepeat,
    }),
    [currentIndex, error, importing, repeat, shuffle, status, tracks, volume],
  );

  return (
    <MusicContext.Provider value={value}>{children}</MusicContext.Provider>
  );
};

export const useMusic = () => useContext(MusicContext);
