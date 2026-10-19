/* eslint-disable react/jsx-one-expression-per-line */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useMusic } from '../music/MusicProvider';

const clock = seconds => {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};

const NowPlayingApp = () => {
  const music = useMusic();
  const track = music.currentTrack;
  const position = music.status.currentTime || 0;
  const total = music.status.duration || (track && track.duration) || 0;
  const progress = total ? Math.min(1, position / total) : 0;
  if (!track) {
    return (
      <View style={styles.empty}>
        <Ionicons name="musical-notes" size={64} color="#8e8e93" />
        <Text style={styles.emptyTitle}>Nada en reproducción</Text>
        <Text style={styles.detail}>
          Abre Música e importa o elige una pista.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <View style={styles.art}>
        <Ionicons name="musical-notes" size={58} color="#ff2d55" />
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {track.name || track.title}
      </Text>
      <Text numberOfLines={1} style={styles.detail}>
        {track.artist || 'Biblioteca del reloj'}
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progress, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.times}>
        <Text style={styles.time}>{clock(position)}</Text>
        <Text style={styles.time}>-{clock(Math.max(0, total - position))}</Text>
      </View>
      <View style={styles.controls}>
        <Pressable onPress={music.previous} style={styles.control}>
          <Ionicons name="play-skip-back" size={27} color="#fff" />
        </Pressable>
        <Pressable onPress={music.togglePlayback} style={styles.play}>
          <Ionicons
            name={music.status.playing ? 'pause' : 'play'}
            size={34}
            color="#fff"
          />
        </Pressable>
        <Pressable onPress={music.next} style={styles.control}>
          <Ionicons name="play-skip-forward" size={27} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.volume}>
        <Ionicons name="volume-low" size={17} color="#8e8e93" />
        <Pressable
          onPress={() => music.setVolume(Math.max(0, music.volume - 0.1))}
          style={styles.volumeButton}
        >
          <Text style={styles.volumeText}>−</Text>
        </Pressable>
        <Text style={styles.volumeValue}>
          {`${Math.round(music.volume * 100)}%`}
        </Text>
        <Pressable
          onPress={() => music.setVolume(Math.min(1, music.volume + 0.1))}
          style={styles.volumeButton}
        >
          <Text style={styles.volumeText}>+</Text>
        </Pressable>
        <Ionicons name="volume-high" size={17} color="#8e8e93" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: '100%', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 20 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 12 },
  art: {
    width: 118,
    height: 118,
    borderRadius: 24,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '800', maxWidth: '95%' },
  detail: { color: '#8e8e93', fontSize: 11, marginTop: 4, textAlign: 'center' },
  progressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: '#3a3a3c',
    borderRadius: 3,
    marginTop: 15,
    overflow: 'hidden',
  },
  progress: { height: 5, backgroundColor: '#fff' },
  times: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  time: { color: '#8e8e93', fontSize: 9, fontVariant: ['tabular-nums'] },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 26,
    marginVertical: 16,
  },
  control: { padding: 5 },
  play: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volume: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volumeButton: {
    width: 34,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeText: { color: '#fff', fontSize: 20 },
  volumeValue: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

export default NowPlayingApp;
