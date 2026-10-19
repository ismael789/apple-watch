/* @flow */

import React, { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Brightness from 'expo-brightness';

import {
  FLASHLIGHT_FLASH,
  FLASHLIGHT_MODES,
  FLASHLIGHT_RED,
  FLASHLIGHT_WHITE,
  flashlightModeForSwipe,
  flashlightViewportStyle,
} from '../flashlight/modes';

type Props = {
  height: number,
  mode: string,
  onModeChange: string => void,
  onClose: () => void,
  width: number,
};

const MODE_LABELS = {
  [FLASHLIGHT_WHITE]: 'Luz blanca fija',
  [FLASHLIGHT_FLASH]: 'Luz blanca intermitente',
  [FLASHLIGHT_RED]: 'Luz roja fija',
};

const WatchFlashlight = ({
  height,
  mode,
  onModeChange,
  onClose,
  width,
}: Props) => {
  const [flashlightOn, setFlashlightOn] = useState(true);

  useEffect(() => {
    let closed = false;
    let brightnessOverridden = false;
    let previousBrightness = null;

    const maximizeBrightness = async () => {
      try {
        const available = await Brightness.isAvailableAsync();
        if (!available || closed) return;
        previousBrightness = await Brightness.getBrightnessAsync();
        if (closed) return;
        await Brightness.setBrightnessAsync(1);
        brightnessOverridden = true;
        if (closed && previousBrightness !== null) {
          await Brightness.setBrightnessAsync(previousBrightness);
        }
      } catch (brightnessError) {
        // La superficie luminosa sigue funcionando aunque el sistema rechace
        // el control temporal del brillo.
      }
    };

    maximizeBrightness();
    return () => {
      closed = true;
      if (brightnessOverridden && previousBrightness !== null) {
        Brightness.setBrightnessAsync(previousBrightness).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    setFlashlightOn(true);
    if (mode !== FLASHLIGHT_FLASH) return undefined;
    const flashTimer = setInterval(() => setFlashlightOn(value => !value), 500);
    return () => clearInterval(flashTimer);
  }, [mode]);

  const panResponder = useMemo(() => {
    const isHorizontalSwipe = (gesture: Object) =>
      Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => isHorizontalSwipe(gesture),
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        isHorizontalSwipe(gesture),
      onPanResponderRelease: (_, gesture) => {
        onModeChange(flashlightModeForSwipe(mode, gesture.dx));
      },
      onPanResponderTerminate: () => {},
    });
  }, [mode, onModeChange]);

  let backgroundColor = '#ffffff';
  if (mode === FLASHLIGHT_RED) backgroundColor = '#ff3b30';
  else if (mode === FLASHLIGHT_FLASH && !flashlightOn)
    backgroundColor = '#000000';
  const darkControls = backgroundColor === '#ffffff';

  return (
    <View
      accessibilityHint="Desliza horizontalmente para cambiar de modo"
      accessibilityLabel={MODE_LABELS[mode]}
      style={[
        styles.container,
        { backgroundColor },
        flashlightViewportStyle(width, height),
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable
        accessibilityLabel="Cerrar linterna"
        hitSlop={8}
        onPress={onClose}
        style={styles.closeButton}
      >
        <Text
          style={[styles.closeText, darkControls && styles.controlTextDark]}
        >
          ×
        </Text>
      </Pressable>
      <View style={styles.modeIndicator}>
        {FLASHLIGHT_MODES.map(candidate => (
          <Pressable
            accessibilityLabel={`Seleccionar ${MODE_LABELS[candidate]}`}
            key={candidate}
            onPress={() => onModeChange(candidate)}
            style={styles.modeTarget}
          >
            <View
              style={[
                styles.modeDot,
                darkControls && styles.modeDotDark,
                candidate === mode && styles.modeDotSelected,
                candidate === mode &&
                  darkControls &&
                  styles.modeDotSelectedDark,
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View pointerEvents="none" style={styles.helpArea}>
        {mode === FLASHLIGHT_FLASH && (
          <Text
            style={[styles.warning, darkControls && styles.controlTextDark]}
          >
            Luz intermitente
          </Text>
        )}
        <Text style={[styles.hint, darkControls && styles.controlTextDark]}>
          Desliza para cambiar · Corona para salir
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 60,
  },
  modeIndicator: {
    position: 'absolute',
    top: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 11,
    left: 12,
    zIndex: 2,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 29,
  },
  modeTarget: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  modeDotDark: { backgroundColor: 'rgba(0,0,0,0.28)' },
  modeDotSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  modeDotSelectedDark: { backgroundColor: '#000000' },
  helpArea: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 15,
    alignItems: 'center',
  },
  warning: {
    marginBottom: 5,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    fontWeight: '700',
  },
  hint: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 9,
    textAlign: 'center',
  },
  controlTextDark: { color: 'rgba(0,0,0,0.48)' },
});

export default WatchFlashlight;
