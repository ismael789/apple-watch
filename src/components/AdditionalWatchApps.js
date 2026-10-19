/* eslint-disable react/jsx-one-expression-per-line, react/prop-types, no-nested-ternary, import/no-unresolved */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import MapView, { Marker } from 'react-native-maps';

import { moonPhase, nextMoonPhases, solarTimes } from '../math/astronomy';
import { bearingDegrees, distanceMeters } from '../math/geo';
import {
  WORLD_CITIES,
  cityDateParts,
  timeZoneOffsetMinutes,
} from '../time/worldClock';
import { readStored, writeStored } from '../storage';
import {
  copyIntoPrivateStorage,
  deleteManagedFile,
  keepExistingManagedFiles,
  removeManagedTemporaryFile,
} from '../storageManager';

const Action = ({ label, onPress, color = '#0a84ff', disabled = false }) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    style={[
      styles.action,
      { backgroundColor: color, opacity: disabled ? 0.45 : 1 },
    ]}
  >
    <Text style={styles.actionText}>{label}</Text>
  </Pressable>
);

const Input = props => (
  <TextInput
    {...props}
    placeholderTextColor="#737377"
    style={[styles.input, props.multiline && styles.multiline]}
  />
);

const formatDuration = seconds =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60,
  ).padStart(2, '0')}`;

const AdditionalWatchApps = ({ app, settings }) => {
  const [now, setNow] = useState(new Date());
  const [cities, setCities] = useState([]);
  const [citySearch, setCitySearch] = useState('');
  const [mindMode, setMindMode] = useState('breathe');
  const [mindDuration, setMindDuration] = useState(60);
  const [mindRemaining, setMindRemaining] = useState(0);
  const [mindPaused, setMindPaused] = useState(false);
  const [mindHistory, setMindHistory] = useState([]);
  const [noiseHistory, setNoiseHistory] = useState([]);
  const [noiseSamples, setNoiseSamples] = useState([]);
  const [noiseError, setNoiseError] = useState('');
  const noiseRecorder = useAudioRecorder({
    ...RecordingPresets.LOW_QUALITY,
    isMeteringEnabled: true,
  });
  const noiseState = useAudioRecorderState(noiseRecorder, 200);
  const [medications, setMedications] = useState([]);
  const [medicineName, setMedicineName] = useState('');
  const [medicineDose, setMedicineDose] = useState('');
  const [medicineTime, setMedicineTime] = useState('08:00');
  const [medicineDays, setMedicineDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [editingMedication, setEditingMedication] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [waypointName, setWaypointName] = useState('');
  const [waypointColor, setWaypointColor] = useState('#ff9f0a');
  const [waypointIcon, setWaypointIcon] = useState('flag');
  const [editingWaypoint, setEditingWaypoint] = useState(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [position, setPosition] = useState(null);
  const [heading, setHeading] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [astronomy, setAstronomy] = useState(null);
  const [washRemaining, setWashRemaining] = useState(20);
  const [washRunning, setWashRunning] = useState(false);
  const [washPaused, setWashPaused] = useState(false);
  const [washHistory, setWashHistory] = useState([]);
  const washPulse = useRef(new Animated.Value(1)).current;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraDelay, setCameraDelay] = useState(3);
  const [cameraCountdown, setCameraCountdown] = useState(null);
  const [remotePhoto, setRemotePhoto] = useState(null);
  const [remotePhotos, setRemotePhotos] = useState([]);
  const [cameraStatus, setCameraStatus] = useState('');
  const lastMedicationAlert = useRef('');

  useEffect(() => {
    Promise.all([
      readStored('worldCities', []),
      readStored('mindfulnessHistory', []),
      readStored('noiseHistory', []),
      readStored('medications', []),
      readStored('waypoints', []),
      readStored('handwashingHistory', []),
      readStored('photos', []),
    ]).then(
      async ([savedCities, mind, noise, meds, points, washes, photos]) => {
        setCities(savedCities);
        setMindHistory(mind);
        setNoiseHistory(noise);
        setMedications(meds);
        setWaypoints(points);
        setWashHistory(washes);
        setRemotePhotos(await keepExistingManagedFiles(photos));
      },
    );
  }, []);

  useEffect(() => {
    if (app.id !== 'world-clock') return undefined;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [app.id]);

  useEffect(() => {
    if (!mindRemaining || mindPaused) return undefined;
    const timer = setInterval(() => {
      setMindRemaining(value => {
        if (value > 1) return value - 1;
        const record = {
          id: String(Date.now()),
          mode: mindMode,
          seconds: mindDuration,
          date: new Date().toISOString(),
        };
        const next = [record, ...mindHistory].slice(0, 30);
        setMindHistory(next);
        writeStored('mindfulnessHistory', next);
        if (settings.haptics) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [
    mindDuration,
    mindHistory,
    mindMode,
    mindPaused,
    mindRemaining,
    settings.haptics,
  ]);

  useEffect(() => {
    if (
      mindRemaining > 0 &&
      !mindPaused &&
      mindMode === 'breathe' &&
      mindRemaining % 4 === 0 &&
      settings.haptics
    ) {
      Haptics.selectionAsync().catch(() => {});
    }
  }, [mindMode, mindPaused, mindRemaining, settings.haptics]);

  useEffect(() => {
    if (!noiseState.isRecording || typeof noiseState.metering !== 'number')
      return;
    setNoiseSamples(value => [...value.slice(-149), noiseState.metering]);
  }, [noiseState.isRecording, noiseState.metering]);

  useEffect(() => {
    if (app.id !== 'medications') return undefined;
    const check = () => {
      const date = new Date();
      const current = `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes(),
      ).padStart(2, '0')}`;
      const due = medications.find(
        item =>
          item.time === current &&
          (!item.days || item.days.includes(date.getDay())),
      );
      const key = due
        ? `${due.id}-${date.toLocaleDateString('en-CA')}-${current}`
        : '';
      if (due && lastMedicationAlert.current !== key) {
        lastMedicationAlert.current = key;
        Alert.alert('Medicamento', `${due.name} · ${due.dose}`);
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, [app.id, medications]);

  useEffect(() => {
    if (!washRunning || washPaused) return undefined;
    const timer = setInterval(() => {
      setWashRemaining(value => {
        if (value > 1) return value - 1;
        const next = [
          {
            id: String(Date.now()),
            date: new Date().toISOString(),
            seconds: 20,
          },
          ...washHistory,
        ].slice(0, 30);
        setWashHistory(next);
        writeStored('handwashingHistory', next);
        setWashRunning(false);
        if (settings.haptics) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.haptics, washHistory, washPaused, washRunning]);

  useEffect(() => {
    if (!washRunning || washPaused) {
      washPulse.stopAnimation();
      washPulse.setValue(1);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(washPulse, {
          toValue: 1.12,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(washPulse, {
          toValue: 0.92,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [washPaused, washPulse, washRunning]);

  useEffect(() => {
    if (app.id !== 'waypoints') return undefined;
    let subscription;
    Magnetometer.isAvailableAsync().then(available => {
      if (!available) return;
      Magnetometer.setUpdateInterval(300);
      subscription = Magnetometer.addListener(({ x, y }) => {
        setHeading(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
      });
    });
    return () => {
      if (subscription) subscription.remove();
    };
  }, [app.id]);

  const updateCities = next => {
    setCities(next);
    writeStored('worldCities', next);
  };

  const moveCity = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= cities.length) return;
    const next = [...cities];
    [next[index], next[target]] = [next[target], next[index]];
    updateCities(next);
  };

  const toggleNoise = async () => {
    setNoiseError('');
    if (noiseState.isRecording) {
      await noiseRecorder.stop();
      const samples = noiseSamples;
      if (samples.length) {
        const record = {
          id: String(Date.now()),
          date: new Date().toISOString(),
          averageDbfs:
            samples.reduce((sum, value) => sum + value, 0) / samples.length,
          peakDbfs: Math.max(...samples),
        };
        const next = [record, ...noiseHistory].slice(0, 20);
        setNoiseHistory(next);
        await writeStored('noiseHistory', next);
      }
      await removeManagedTemporaryFile(noiseRecorder.uri).catch(() => {});
      await setAudioModeAsync({ allowsRecording: false });
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setNoiseError('Permiso del micrófono rechazado.');
      return;
    }
    setNoiseSamples([]);
    await setAudioModeAsync({ allowsRecording: true });
    await noiseRecorder.prepareToRecordAsync();
    noiseRecorder.record();
  };

  const saveMedication = () => {
    if (
      !medicineName.trim() ||
      !medicineDose.trim() ||
      !/^\d{2}:\d{2}$/.test(medicineTime)
    )
      return;
    const next = editingMedication
      ? medications.map(item =>
          item.id === editingMedication
            ? {
                ...item,
                name: medicineName.trim(),
                dose: medicineDose.trim(),
                time: medicineTime,
                days: medicineDays,
              }
            : item,
        )
      : [
          ...medications,
          {
            id: String(Date.now()),
            name: medicineName.trim(),
            dose: medicineDose.trim(),
            time: medicineTime,
            days: medicineDays,
            history: [],
          },
        ];
    setMedications(next);
    writeStored('medications', next);
    setMedicineName('');
    setMedicineDose('');
    setMedicineDays([0, 1, 2, 3, 4, 5, 6]);
    setEditingMedication(null);
  };

  const logDose = (medicine, state) => {
    const next = medications.map(item =>
      item.id === medicine.id
        ? {
            ...item,
            history: [
              { id: String(Date.now()), state, date: new Date().toISOString() },
              ...(item.history || []),
            ].slice(0, 60),
          }
        : item,
    );
    setMedications(next);
    writeStored('medications', next);
  };

  const refreshPosition = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setLocationError('Permiso de ubicación rechazado.');
      return null;
    }
    const result = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const coordinates = {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
    };
    setPosition(coordinates);
    setLocationError('');
    return coordinates;
  };

  const saveWaypoint = async () => {
    if (!waypointName.trim()) return;
    const coordinates = editingWaypoint ? null : await refreshPosition();
    if (!editingWaypoint && !coordinates) return;
    const next = editingWaypoint
      ? waypoints.map(item =>
          item.id === editingWaypoint
            ? {
                ...item,
                name: waypointName.trim(),
                color: waypointColor,
                icon: waypointIcon,
              }
            : item,
        )
      : [
          ...waypoints,
          {
            id: String(Date.now()),
            name: waypointName.trim(),
            color: waypointColor,
            icon: waypointIcon,
            ...coordinates,
          },
        ];
    setWaypoints(next);
    writeStored('waypoints', next);
    setWaypointName('');
    setEditingWaypoint(null);
  };

  const calculateAstronomy = async () => {
    const coordinates = await refreshPosition();
    if (!coordinates) return;
    setAstronomy({
      coordinates,
      solar: solarTimes(
        new Date(),
        coordinates.latitude,
        coordinates.longitude,
      ),
      moon: moonPhase(new Date()),
      nextPhases: nextMoonPhases(new Date()),
    });
  };

  const captureRemote = () => {
    if (!cameraReady || cameraCountdown !== null) return;
    if (!cameraDelay) {
      cameraRef.current
        .takePictureAsync({ quality: 0.8 })
        .then(result => setRemotePhoto(result.uri));
      return;
    }
    setCameraCountdown(cameraDelay);
    let value = cameraDelay;
    const timer = setInterval(() => {
      value -= 1;
      if (value > 0) setCameraCountdown(value);
      else {
        clearInterval(timer);
        setCameraCountdown(null);
        cameraRef.current
          .takePictureAsync({ quality: 0.8 })
          .then(result => setRemotePhoto(result.uri));
      }
    }, 1000);
  };

  const saveRemotePhoto = async () => {
    let copied;
    try {
      copied = await copyIntoPrivateStorage({
        sourceUri: remotePhoto,
        kind: 'photos',
        originalName: `camera-remote-${Date.now()}.jpg`,
      });
      const next = [copied.uri, ...remotePhotos];
      if (!(await writeStored('photos', next))) {
        throw new Error('No se pudo registrar la fotografía.');
      }
      setRemotePhotos(next);
      await removeManagedTemporaryFile(remotePhoto);
      setRemotePhoto(null);
      setCameraStatus('Fotografía guardada en Fotos del reloj');
    } catch (saveError) {
      if (copied) await deleteManagedFile(copied.uri).catch(() => {});
      setCameraStatus('No se pudo guardar la fotografía');
    }
  };

  if (app.id === 'world-clock') {
    const localOffset = -now.getTimezoneOffset();
    const matches = WORLD_CITIES.filter(
      city =>
        city.name.toLowerCase().includes(citySearch.toLowerCase()) &&
        !cities.some(item => item.timeZone === city.timeZone),
    );
    return (
      <View style={styles.full}>
        <Input
          value={citySearch}
          onChangeText={setCitySearch}
          placeholder="Buscar ciudad"
        />
        {!!citySearch &&
          matches.slice(0, 4).map(city => (
            <Pressable
              key={city.timeZone}
              style={styles.card}
              onPress={() => {
                updateCities([...cities, city]);
                setCitySearch('');
              }}
            >
              <Ionicons name="add-circle" size={20} color="#ff9f0a" />
              <Text style={styles.cardTitle}>{city.name}</Text>
            </Pressable>
          ))}
        {cities.map((city, index) => {
          const value = cityDateParts(now, city.timeZone);
          const difference =
            (timeZoneOffsetMinutes(now, city.timeZone) - localOffset) / 60;
          return (
            <View key={city.timeZone} style={styles.card}>
              <Ionicons
                name={value.isDay ? 'sunny' : 'moon'}
                size={22}
                color={value.isDay ? '#ffd60a' : '#7d7aff'}
              />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>
                  {city.name} · {value.time}
                </Text>
                <Text style={styles.detail}>
                  {value.date} · {difference >= 0 ? '+' : ''}
                  {difference} h
                </Text>
              </View>
              <Pressable onPress={() => moveCity(index, -1)}>
                <Ionicons name="chevron-up" size={17} color="#8e8e93" />
              </Pressable>
              <Pressable onPress={() => moveCity(index, 1)}>
                <Ionicons name="chevron-down" size={17} color="#8e8e93" />
              </Pressable>
              <Pressable
                onPress={() =>
                  updateCities(
                    cities.filter(item => item.timeZone !== city.timeZone),
                  )
                }
              >
                <Ionicons name="trash" size={17} color="#ff453a" />
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  }

  if (app.id === 'mindfulness') {
    const elapsed = mindDuration - mindRemaining;
    const inhale = Math.floor(elapsed / 4) % 2 === 0;
    return (
      <View style={styles.fullCentered}>
        <View
          style={[
            styles.breatheOrb,
            mindRemaining && (inhale ? styles.breatheIn : styles.breatheOut),
          ]}
        >
          <Text style={styles.orbText}>
            {mindMode === 'breathe'
              ? inhale
                ? 'Inhala'
                : 'Exhala'
              : 'Reflexiona'}
          </Text>
        </View>
        <Text style={styles.timer}>
          {formatDuration(mindRemaining || mindDuration)}
        </Text>
        {!mindRemaining && (
          <Text style={styles.prompt}>
            {mindMode === 'reflect'
              ? 'Piensa en algo positivo que puedas aportar hoy.'
              : 'Sigue el ritmo visual y respira con calma.'}
          </Text>
        )}
        <View style={styles.row}>
          <Action
            label="Respirar"
            onPress={() => setMindMode('breathe')}
            color={mindMode === 'breathe' ? '#0a84ff' : '#3a3a3c'}
          />
          <Action
            label="Reflexionar"
            onPress={() => setMindMode('reflect')}
            color={mindMode === 'reflect' ? '#bf5af2' : '#3a3a3c'}
          />
        </View>
        {!mindRemaining ? (
          <>
            <Action
              label={`${mindDuration / 60} min`}
              onPress={() =>
                setMindDuration(value => (value >= 180 ? 60 : value + 60))
              }
              color="#3a3a3c"
            />
            <Action
              label="Iniciar"
              onPress={() => {
                setMindRemaining(mindDuration);
                setMindPaused(false);
              }}
            />
          </>
        ) : (
          <View style={styles.row}>
            <Action
              label={mindPaused ? 'Continuar' : 'Pausar'}
              onPress={() => setMindPaused(value => !value)}
            />
            <Action
              label="Finalizar"
              color="#ff453a"
              onPress={() => setMindRemaining(0)}
            />
          </View>
        )}
        {mindHistory.slice(0, 3).map(item => (
          <Text key={item.id} style={styles.detail}>
            {item.mode} · {item.seconds / 60} min ·{' '}
            {new Date(item.date).toLocaleDateString('es-MX')}
          </Text>
        ))}
      </View>
    );
  }

  if (app.id === 'noise') {
    const meter =
      typeof noiseState.metering === 'number' ? noiseState.metering : -60;
    const intensity = Math.max(0, Math.min(1, (meter + 60) / 60));
    return (
      <View style={styles.fullCentered}>
        <Ionicons name="ear" size={55} color="#ffffff" />
        <Text style={styles.hero}>
          {noiseState.isRecording ? `${meter.toFixed(1)} dBFS` : '—'}
        </Text>
        <View style={styles.meter}>
          <View style={[styles.meterFill, { width: `${intensity * 100}%` }]} />
        </View>
        <Text style={styles.prompt}>
          Intensidad relativa del micrófono, no dB SPL calibrados. No se
          conserva audio.
        </Text>
        <Action
          label={noiseState.isRecording ? 'Detener' : 'Medir'}
          color={noiseState.isRecording ? '#ff453a' : '#30d158'}
          onPress={toggleNoise}
        />
        {!!noiseError && <Text style={styles.error}>{noiseError}</Text>}
        {noiseHistory.slice(0, 4).map(item => (
          <Text key={item.id} style={styles.detail}>
            {new Date(item.date).toLocaleString('es-MX')} · pico{' '}
            {item.peakDbfs.toFixed(1)} dBFS
          </Text>
        ))}
      </View>
    );
  }

  if (app.id === 'medications') {
    return (
      <View style={styles.full}>
        <Input
          value={medicineName}
          onChangeText={setMedicineName}
          placeholder="Medicamento"
        />
        <Input
          value={medicineDose}
          onChangeText={setMedicineDose}
          placeholder="Dosis y unidad"
        />
        <Input
          value={medicineTime}
          onChangeText={setMedicineTime}
          placeholder="HH:MM"
        />
        <View style={styles.days}>
          {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, index) => (
            <Pressable
              key={day}
              onPress={() =>
                setMedicineDays(value =>
                  value.includes(index)
                    ? value.filter(item => item !== index)
                    : [...value, index],
                )
              }
              style={[
                styles.day,
                medicineDays.includes(index) && styles.dayActive,
              ]}
            >
              <Text style={styles.dayText}>{day}</Text>
            </Pressable>
          ))}
        </View>
        <Action
          label={editingMedication ? 'Guardar cambios' : 'Guardar medicamento'}
          onPress={saveMedication}
        />
        {medications.map(item => (
          <View key={item.id} style={styles.medicationCard}>
            <Pressable
              onPress={() => {
                setEditingMedication(item.id);
                setMedicineName(item.name);
                setMedicineDose(item.dose);
                setMedicineTime(item.time);
                setMedicineDays(item.days || [0, 1, 2, 3, 4, 5, 6]);
              }}
            >
              <Text style={styles.cardTitle}>
                {item.name} · {item.dose}
              </Text>
            </Pressable>
            <Text style={styles.detail}>Próxima hora: {item.time}</Text>
            <View style={styles.row}>
              <Action
                label="Tomada"
                color="#30d158"
                onPress={() => logDose(item, 'taken')}
              />
              <Action
                label="Omitida"
                color="#ff9f0a"
                onPress={() => logDose(item, 'skipped')}
              />
              <Pressable
                onPress={() => {
                  const next = medications.filter(
                    value => value.id !== item.id,
                  );
                  setMedications(next);
                  writeStored('medications', next);
                }}
              >
                <Ionicons name="trash" size={20} color="#ff453a" />
              </Pressable>
            </View>
            {(item.history || []).slice(0, 2).map(record => (
              <Text key={record.id} style={styles.detail}>
                {record.state === 'taken' ? 'Tomada' : 'Omitida'} ·{' '}
                {new Date(record.date).toLocaleString('es-MX')}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (app.id === 'waypoints') {
    return (
      <View style={styles.full}>
        <Input
          value={waypointName}
          onChangeText={setWaypointName}
          placeholder="Nombre del punto"
        />
        <View style={styles.row}>
          {['#ff9f0a', '#ff375f', '#30d158', '#0a84ff'].map(color => (
            <Pressable
              key={color}
              onPress={() => setWaypointColor(color)}
              style={[
                styles.waypointColor,
                { backgroundColor: color },
                waypointColor === color && styles.waypointSelected,
              ]}
            />
          ))}
          {['flag', 'home', 'school'].map(icon => (
            <Pressable
              key={icon}
              onPress={() => setWaypointIcon(icon)}
              style={[
                styles.waypointIcon,
                waypointIcon === icon && styles.waypointSelected,
              ]}
            >
              <Ionicons name={icon} size={17} color="#ffffff" />
            </Pressable>
          ))}
        </View>
        <Action
          label={
            editingWaypoint ? 'Guardar nombre' : 'Guardar ubicación actual'
          }
          onPress={saveWaypoint}
        />
        <Action
          label="Actualizar posición"
          color="#3a3a3c"
          onPress={refreshPosition}
        />
        {!!locationError && <Text style={styles.error}>{locationError}</Text>}
        {selectedWaypoint && (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: selectedWaypoint.latitude,
              longitude: selectedWaypoint.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker
              coordinate={{
                latitude: selectedWaypoint.latitude,
                longitude: selectedWaypoint.longitude,
              }}
              title={selectedWaypoint.name}
              pinColor={selectedWaypoint.color}
            />
          </MapView>
        )}
        {waypoints.map(point => {
          const target = {
            latitude: point.latitude,
            longitude: point.longitude,
          };
          const distance = position ? distanceMeters(position, target) : null;
          const bearing = position ? bearingDegrees(position, target) : 0;
          return (
            <View key={point.id} style={styles.card}>
              <Ionicons
                name="navigate"
                size={25}
                color={point.color}
                style={{
                  transform: [{ rotate: `${bearing - (heading || 0)}deg` }],
                }}
              />
              <Pressable
                style={styles.flex}
                onPress={() => setSelectedWaypoint(point)}
                onLongPress={() => {
                  setEditingWaypoint(point.id);
                  setWaypointName(point.name);
                  setWaypointColor(point.color);
                  setWaypointIcon(point.icon);
                }}
              >
                <Text style={styles.cardTitle}>{point.name}</Text>
                <Text style={styles.detail}>
                  {distance === null
                    ? 'Actualiza la posición'
                    : `${Math.round(distance)} m · rumbo ${Math.round(
                        bearing,
                      )}°`}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const next = waypoints.filter(item => item.id !== point.id);
                  setWaypoints(next);
                  writeStored('waypoints', next);
                }}
              >
                <Ionicons name="trash" size={18} color="#ff453a" />
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  }

  if (app.id === 'astronomy') {
    const solar = astronomy && astronomy.solar;
    const moon = astronomy && astronomy.moon;
    return (
      <View style={styles.fullCentered}>
        <View style={styles.celestialRow}>
          <Ionicons name="sunny" size={55} color="#ffd60a" />
          <Ionicons name="moon" size={48} color="#bf5af2" />
        </View>
        <Action
          label="Calcular para mi ubicación"
          onPress={calculateAstronomy}
        />
        {!!locationError && <Text style={styles.error}>{locationError}</Text>}
        {solar && (
          <>
            <Text style={styles.cardTitle}>
              Amanecer:{' '}
              {solar.sunrise
                ? solar.sunrise.toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : solar.polarDay
                ? 'Sol de medianoche'
                : 'Noche polar'}
            </Text>
            <Text style={styles.cardTitle}>
              Atardecer:{' '}
              {solar.sunset
                ? solar.sunset.toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'No ocurre hoy'}
            </Text>
            {solar.dayLengthMinutes && (
              <Text style={styles.detail}>
                Duración del día: {Math.floor(solar.dayLengthMinutes / 60)} h{' '}
                {solar.dayLengthMinutes % 60} min
              </Text>
            )}
          </>
        )}
        {moon && (
          <View style={styles.moonCard}>
            <Text style={styles.hero}>
              {Math.round(moon.illumination * 100)}%
            </Text>
            <Text style={styles.cardTitle}>{moon.name}</Text>
            <Text style={styles.detail}>
              Edad lunar aproximada: {moon.ageDays.toFixed(1)} días
            </Text>
          </View>
        )}
        {astronomy &&
          astronomy.nextPhases.slice(0, 4).map(phase => (
            <Text key={phase.name} style={styles.detail}>
              {phase.name} · {phase.date.toLocaleDateString('es-MX')}
            </Text>
          ))}
      </View>
    );
  }

  if (app.id === 'handwashing') {
    const progress = (20 - washRemaining) / 20;
    return (
      <View style={styles.fullCentered}>
        <Animated.View style={{ transform: [{ scale: washPulse }] }}>
          <Ionicons name="water" size={68} color="#64d2ff" />
        </Animated.View>
        <Text style={styles.timer}>{washRemaining}</Text>
        <View style={styles.meter}>
          <View style={[styles.washFill, { width: `${progress * 100}%` }]} />
        </View>
        {!washRunning ? (
          <Action
            label="Iniciar 20 segundos"
            onPress={() => {
              setWashRemaining(20);
              setWashPaused(false);
              setWashRunning(true);
            }}
          />
        ) : (
          <View style={styles.row}>
            <Action
              label={washPaused ? 'Continuar' : 'Pausar'}
              color="#ff9f0a"
              onPress={() => setWashPaused(value => !value)}
            />
            <Action
              label="Cancelar"
              color="#ff453a"
              onPress={() => {
                setWashRunning(false);
                setWashPaused(false);
                setWashRemaining(20);
              }}
            />
          </View>
        )}
        {washRemaining === 0 && (
          <Text style={styles.success}>Lavado completado</Text>
        )}
        {washHistory.slice(0, 4).map(item => (
          <Text key={item.id} style={styles.detail}>
            {new Date(item.date).toLocaleString('es-MX')} · 20 s
          </Text>
        ))}
      </View>
    );
  }

  if (app.id === 'camera-remote') {
    if (!cameraPermission || !cameraPermission.granted) {
      return (
        <View style={styles.fullCentered}>
          <Ionicons name="camera" size={60} color="#ffffff" />
          <Action label="Permitir cámara" onPress={requestCameraPermission} />
        </View>
      );
    }
    return (
      <View style={styles.fullCentered}>
        {remotePhoto ? (
          <>
            <Image source={{ uri: remotePhoto }} style={styles.photo} />
            <View style={styles.row}>
              <Action
                label="Repetir"
                color="#3a3a3c"
                onPress={() => setRemotePhoto(null)}
              />
              <Action label="Guardar" onPress={saveRemotePhoto} />
            </View>
          </>
        ) : (
          <View style={styles.camera}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={cameraFacing}
              onCameraReady={() => setCameraReady(true)}
            />
            <View style={styles.cameraControls}>
              <Pressable
                onPress={() =>
                  setCameraFacing(value =>
                    value === 'back' ? 'front' : 'back',
                  )
                }
              >
                <Ionicons name="camera-reverse" size={28} color="#ffffff" />
              </Pressable>
              <Pressable
                disabled={!cameraReady}
                style={styles.shutter}
                onPress={captureRemote}
              />
              <Pressable
                onPress={() =>
                  setCameraDelay(value =>
                    value === 0 ? 3 : value === 3 ? 10 : 0,
                  )
                }
              >
                <Text style={styles.delay}>{cameraDelay}s</Text>
              </Pressable>
            </View>
            {cameraCountdown !== null && (
              <View style={styles.countdown}>
                <Text style={styles.countdownText}>{cameraCountdown}</Text>
              </View>
            )}
          </View>
        )}
        {!!cameraStatus && <Text style={styles.success}>{cameraStatus}</Text>}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  full: { width: '100%' },
  fullCentered: { width: '100%', alignItems: 'center' },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  action: {
    minWidth: 82,
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginTop: 9,
    borderRadius: 18,
  },
  actionText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  input: {
    width: '100%',
    minHeight: 42,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    color: '#ffffff',
    textAlign: 'center',
    backgroundColor: '#1c1c1e',
  },
  multiline: { minHeight: 72 },
  card: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginTop: 8,
    borderRadius: 15,
    backgroundColor: '#1c1c1e',
  },
  medicationCard: {
    width: '100%',
    padding: 12,
    marginTop: 9,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
  },
  days: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  day: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#2c2c2e',
  },
  dayActive: { backgroundColor: '#ff375f' },
  dayText: { color: '#ffffff', fontSize: 9, fontWeight: '700' },
  cardTitle: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  detail: { color: '#8e8e93', fontSize: 9, marginTop: 3 },
  prompt: {
    color: '#a1a1a6',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginVertical: 8,
  },
  error: { color: '#ff453a', fontSize: 10, textAlign: 'center', marginTop: 8 },
  success: {
    color: '#30d158',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
  },
  hero: { color: '#ffffff', fontSize: 35, fontWeight: '300', marginTop: 8 },
  timer: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '200',
    marginVertical: 7,
  },
  breatheOrb: {
    width: 105,
    height: 105,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 53,
    backgroundColor: '#254a68',
  },
  breatheIn: { transform: [{ scale: 1.12 }], backgroundColor: '#0a84ff' },
  breatheOut: { transform: [{ scale: 0.88 }], backgroundColor: '#5856d6' },
  orbText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  meter: {
    width: '100%',
    height: 10,
    overflow: 'hidden',
    borderRadius: 5,
    backgroundColor: '#2c2c2e',
  },
  meterFill: { height: '100%', backgroundColor: '#ffd60a' },
  washFill: { height: '100%', backgroundColor: '#64d2ff' },
  celestialRow: { flexDirection: 'row', gap: 35, marginBottom: 10 },
  moonCard: {
    width: '100%',
    alignItems: 'center',
    padding: 12,
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: '#1c1c1e',
  },
  map: { width: '100%', height: 155, marginTop: 9, borderRadius: 18 },
  waypointColor: { width: 27, height: 27, borderRadius: 14, marginTop: 8 },
  waypointIcon: {
    width: 31,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginTop: 8,
    backgroundColor: '#2c2c2e',
  },
  waypointSelected: { borderWidth: 2, borderColor: '#ffffff' },
  camera: {
    width: '100%',
    height: 285,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#1c1c1e',
  },
  cameraControls: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  shutter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 5,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255,255,255,.35)',
  },
  delay: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  countdown: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,.35)',
  },
  countdownText: { color: '#ffffff', fontSize: 72, fontWeight: '200' },
  photo: { width: '100%', height: 250, borderRadius: 22 },
});

export default AdditionalWatchApps;
