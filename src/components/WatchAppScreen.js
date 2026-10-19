/* global fetch */
/* eslint-disable global-require, react/jsx-one-expression-per-line, react/prop-types, no-nested-ternary, react/jsx-indent, no-await-in-loop, import/no-unresolved */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
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
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import * as Battery from 'expo-battery';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { Magnetometer, Pedometer } from 'expo-sensors';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useMusic } from '../music/MusicProvider';
import StripeWalletPayments from './StripeWalletPayments';
import AdditionalWatchApps from './AdditionalWatchApps';
import GamesCenter from './GamesCenter';
import RemindersApp from './RemindersApp';
import NowPlayingApp from './NowPlayingApp';
import ShortcutsApp from './ShortcutsApp';
import WalkieTalkieApp from './WalkieTalkieApp';
import { readStored, writeStored } from '../storage';
import { useStopwatch } from '../stopwatch/StopwatchProvider';
import {
  copyIntoPrivateStorage,
  deleteManagedFile,
  formatBytes,
  getManagedStorageReport,
  getStorageEnvironment,
  keepExistingManagedFiles,
  removeManagedTemporaryFile,
} from '../storageManager';

const IS_EXPO_GO = Constants.appOwnership === 'expo';
const DEFAULT_WALLET_CARDS = [
  { id: 'school-pass', name: 'Pase escolar', detail: 'Identificación' },
];
const DEFAULT_SETTINGS = {
  sound: true,
  haptics: true,
  stepGoal: 8000,
  brightness: 1,
  alwaysOn: false,
  passcodeEnabled: false,
  passcode: '',
  theaterMode: false,
  focusMode: 'off',
  watchFace: {
    style: 'modular',
    color: '#0a84ff',
    complications: ['activity', 'weather', 'battery'],
  },
};
const duration = value => {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const short = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
  return hours ? `${String(hours).padStart(2, '0')}:${short}` : short;
};

const StopwatchVisual = ({ elapsed, laps, view }) => {
  const seconds = elapsed % 60;
  const longest = Math.max(1, ...laps.map(item => item.time));
  return (
    <>
      {(view === 'analog' || view === 'hybrid') && (
        <View style={styles.stopwatchDial}>
          <Text style={styles.dialTop}>60</Text>
          <View
            style={[
              styles.stopwatchHand,
              { transform: [{ rotate: `${seconds * 6}deg` }] },
            ]}
          />
          <View style={styles.dialCenter} />
        </View>
      )}
      {(view === 'digital' || view === 'hybrid') && (
        <Text style={styles.stopwatch}>{duration(elapsed)}</Text>
      )}
      {view === 'graph' && (
        <View style={styles.lapGraph}>
          {(laps.length
            ? laps.slice(0, 8)
            : [{ id: 'live', time: elapsed }]
          ).map(item => (
            <View
              key={item.id}
              style={[
                styles.lapBar,
                { height: 12 + (item.time / longest) * 74 },
              ]}
            />
          ))}
        </View>
      )}
    </>
  );
};

const metersBetween = (a, b) => {
  const rad = number => (number * Math.PI) / 180;
  const lat = rad(b.latitude - a.latitude);
  const lon = rad(b.longitude - a.longitude);
  const x =
    Math.sin(lat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const weatherText = code => {
  if (code === 0) return ['Despejado', 'sunny'];
  if (code <= 3) return ['Parcialmente nublado', 'partly-sunny'];
  if (code >= 51 && code <= 82) return ['Lluvia', 'rainy'];
  if (code >= 95) return ['Tormenta', 'thunderstorm'];
  return ['Nublado', 'cloudy'];
};

const cardinalDirection = degrees => {
  const directions = [
    'Norte',
    'Noreste',
    'Este',
    'Sureste',
    'Sur',
    'Suroeste',
    'Oeste',
    'Noroeste',
  ];
  return directions[Math.round(degrees / 45) % directions.length];
};

const Button = ({ label, onPress, color = '#0a84ff', disabled = false }) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      { backgroundColor: color, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 },
    ]}
  >
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
);

const Field = ({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#77777d"
    keyboardType={keyboardType}
    style={styles.input}
  />
);

const Notice = ({ children, error = false }) => (
  <View style={[styles.notice, error && styles.noticeError]}>
    <Ionicons
      name={error ? 'alert-circle' : 'information-circle'}
      size={16}
      color={error ? '#ff453a' : '#64d2ff'}
    />
    <Text style={styles.noticeText}>{children}</Text>
  </View>
);

const Metric = ({ value, label, color }) => (
  <View style={styles.metric}>
    <Text style={[styles.metricValue, { color }]}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const WatchAppScreen = ({
  app,
  onClose,
  onSettingsChange,
  sideButtonSignal,
  onShortcutAction,
}) => {
  const music = useMusic();
  const stopwatchState = useStopwatch();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [battery, setBattery] = useState(null);
  const [online, setOnline] = useState(null);
  const [steps, setSteps] = useState(0);
  const [stepInfo, setStepInfo] = useState('Comprobando sensor…');
  const [goal, setGoal] = useState('8000');
  const [activityHistory, setActivityHistory] = useState([]);
  const [heartActive, setHeartActive] = useState(false);
  const [workout, setWorkout] = useState({
    seconds: 0,
    meters: 0,
    running: false,
  });
  const [history, setHistory] = useState([]);
  const [workoutRoute, setWorkoutRoute] = useState([]);
  const workoutStart = useRef(0);
  const workoutBase = useRef(0);
  const locationSub = useRef(null);
  const lastPoint = useRef(null);
  const [phone, setPhone] = useState('');
  const [contacts, setContacts] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [messageDrafts, setMessageDrafts] = useState([]);
  const [musicFavoritesOnly, setMusicFavoritesOnly] = useState(false);
  const [weather, setWeather] = useState(null);
  const [city, setCity] = useState('');
  const [mapPosition, setMapPosition] = useState(null);
  const mapRef = useRef(null);
  const [timer, setTimer] = useState(300);
  const [timerEnd, setTimerEnd] = useState(null);
  const [timerPaused, setTimerPaused] = useState(false);
  const [alarms, setAlarms] = useState([]);
  const [alarmTime, setAlarmTime] = useState('07:30');
  const [alarmLabel, setAlarmLabel] = useState('Alarma');
  const [alarmDays, setAlarmDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [editingAlarm, setEditingAlarm] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(
    new Date().toLocaleDateString('en-CA'),
  );
  const [editingEvent, setEditingEvent] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [viewedPhoto, setViewedPhoto] = useState(null);
  const [photoZoomed, setPhotoZoomed] = useState(false);
  const cameraRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState('back');
  const [cameraFlash, setCameraFlash] = useState('off');
  const [cameraReady, setCameraReady] = useState(false);
  const [heading, setHeading] = useState(null);
  const [compassAvailable, setCompassAvailable] = useState(null);
  const [compassReliable, setCompassReliable] = useState(true);
  const smoothedHeading = useRef(null);
  const [sleepHours, setSleepHours] = useState('8');
  const [sleep, setSleep] = useState([]);
  const [walletCards, setWalletCards] = useState(DEFAULT_WALLET_CARDS);
  const [walletName, setWalletName] = useState('Pase escolar');
  const [walletDetail, setWalletDetail] = useState('Identificación');
  const [storageReport, setStorageReport] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [voiceMemos, setVoiceMemos] = useState([]);
  const [playingMemo, setPlayingMemo] = useState(null);
  const [editingMemo, setEditingMemo] = useState(null);
  const [memoNameDraft, setMemoNameDraft] = useState('');
  const [notes, setNotes] = useState([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [calculatorDisplay, setCalculatorDisplay] = useState('0');
  const calculatorValue = useRef(null);
  const calculatorOperation = useRef(null);
  const calculatorReplace = useRef(true);
  const [passcodeDraft, setPasscodeDraft] = useState('');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const voicePlayer = useAudioPlayer(null);
  const voicePlayerStatus = useAudioPlayerStatus(voicePlayer);

  useEffect(() => {
    let active = true;
    Promise.all([
      readStored('settings', DEFAULT_SETTINGS),
      readStored('alarms', []),
      readStored('events', []),
      readStored('sleep', []),
      readStored('workouts', []),
      readStored('activity', []),
      readStored('weather', null),
      readStored('photos', []),
      readStored('messages', []),
      readStored('walletCards', DEFAULT_WALLET_CARDS),
      readStored('voiceMemos', []),
      readStored('notes', []),
      Battery.getBatteryLevelAsync().catch(() => -1),
      Network.getNetworkStateAsync().catch(() => ({})),
    ]).then(
      async ([
        savedSettings,
        savedAlarms,
        savedEvents,
        savedSleep,
        savedHistory,
        savedActivity,
        savedWeather,
        savedPhotos,
        savedMessages,
        savedWalletCards,
        savedVoiceMemos,
        savedNotes,
        level,
        network,
      ]) => {
        if (!active) return;
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...savedSettings,
          watchFace: {
            ...DEFAULT_SETTINGS.watchFace,
            ...(savedSettings.watchFace || {}),
          },
        };
        setSettings(mergedSettings);
        setGoal(String(mergedSettings.stepGoal));
        setPasscodeDraft(mergedSettings.passcode || '');
        setAlarms(savedAlarms);
        setEvents(savedEvents);
        setSleep(savedSleep);
        setHistory(savedHistory);
        setActivityHistory(savedActivity);
        setWeather(savedWeather);
        const validPhotos = await keepExistingManagedFiles(savedPhotos);
        if (!active) return;
        setPhotos(validPhotos);
        if (validPhotos.length !== savedPhotos.length) {
          await writeStored('photos', validPhotos);
        }
        setMessageDrafts(savedMessages);
        setWalletCards(savedWalletCards);
        const validVoiceUris = await keepExistingManagedFiles(
          savedVoiceMemos.map(item => item.uri),
        );
        const validVoiceMemos = savedVoiceMemos.filter(item =>
          validVoiceUris.includes(item.uri),
        );
        setVoiceMemos(validVoiceMemos);
        if (validVoiceMemos.length !== savedVoiceMemos.length) {
          await writeStored('voiceMemos', validVoiceMemos);
        }
        setNotes(savedNotes);
        if (level >= 0) setBattery(Math.round(level * 100));
        if (network.isConnected !== undefined) setOnline(network.isConnected);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (voicePlayerStatus.didJustFinish) setPlayingMemo(null);
  }, [voicePlayerStatus.didJustFinish]);

  useEffect(() => {
    if (app.id !== 'settings') return;
    setStorageLoading(true);
    getManagedStorageReport()
      .then(setStorageReport)
      .catch(() => setError('No se pudo medir el almacenamiento privado.'))
      .finally(() => setStorageLoading(false));
  }, [app.id]);

  useEffect(() => {
    if (app.id !== 'activity') return undefined;
    let sub;
    let active = true;
    (async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) {
          setStepInfo('Podómetro no disponible en este teléfono.');
          return;
        }
        const permission = await Pedometer.requestPermissionsAsync();
        if (!permission.granted) {
          setStepInfo('Permiso de actividad física rechazado.');
          return;
        }
        if (Platform.OS === 'ios') {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const result = await Pedometer.getStepCountAsync(start, new Date());
          if (active) setSteps(result.steps);
          setStepInfo('Pasos reales de hoy');
        } else setStepInfo('Pasos reales desde que abriste esta pantalla');
        sub = Pedometer.watchStepCount(result => setSteps(result.steps));
      } catch (sensorError) {
        setStepInfo('No fue posible leer el podómetro.');
      }
    })();
    return () => {
      active = false;
      if (sub) sub.remove();
    };
  }, [app.id]);

  useEffect(() => {
    if (!workout.running) return undefined;
    const interval = setInterval(
      () =>
        setWorkout(value => ({
          ...value,
          seconds:
            workoutBase.current + (Date.now() - workoutStart.current) / 1000,
        })),
      250,
    );
    return () => clearInterval(interval);
  }, [workout.running]);

  useEffect(() => {
    if (!timerEnd) return undefined;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      setTimer(remaining);
      if (!remaining) {
        setTimerEnd(null);
        setTimerPaused(false);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        Alert.alert('Temporizador', 'El tiempo terminó.');
      }
    }, 250);
    return () => clearInterval(interval);
  }, [timerEnd]);

  useEffect(() => {
    if (app.id !== 'compass') return undefined;
    let sub;
    (async () => {
      try {
        const available = await Magnetometer.isAvailableAsync();
        setCompassAvailable(available);
        if (!available) return;
        Magnetometer.setUpdateInterval(250);
        sub = Magnetometer.addListener(({ x, y, z }) => {
          const raw = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
          const strength = Math.sqrt(x * x + y * y + z * z);
          setCompassReliable(strength >= 20 && strength <= 70);
          if (smoothedHeading.current === null) smoothedHeading.current = raw;
          const difference =
            ((raw - smoothedHeading.current + 540) % 360) - 180;
          smoothedHeading.current =
            (smoothedHeading.current + difference * 0.22 + 360) % 360;
          setHeading(Math.round(smoothedHeading.current));
        });
      } catch (sensorError) {
        setCompassAvailable(false);
      }
    })();
    return () => {
      if (sub) sub.remove();
      smoothedHeading.current = null;
    };
  }, [app.id]);

  useEffect(
    () => () => {
      if (locationSub.current) locationSub.current.remove();
    },
    [],
  );

  const persistSettings = next => {
    setSettings(next);
    writeStored('settings', next);
    if (onSettingsChange) onSettingsChange(next);
  };

  const saveGoal = () => {
    const number = Number(goal);
    if (!Number.isFinite(number) || number < 100) {
      setError('La meta mínima es de 100 pasos.');
      return;
    }
    persistSettings({ ...settings, stepGoal: Math.round(number) });
    setError('');
    setStatus('Meta guardada');
  };

  const saveActivity = async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const record = {
      id: today,
      date: new Date().toISOString(),
      steps,
      goal: settings.stepGoal,
    };
    const next = [
      record,
      ...activityHistory.filter(item => item.id !== today),
    ].slice(0, 14);
    setActivityHistory(next);
    await writeStored('activity', next);
    setStatus('Actividad guardada');
  };

  const controlWorkout = async () => {
    if (workout.running) {
      workoutBase.current = workout.seconds;
      setWorkout(value => ({ ...value, running: false }));
      if (locationSub.current) locationSub.current.remove();
      locationSub.current = null;
      return;
    }
    setLoading(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        locationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 3,
            timeInterval: 2000,
          },
          position => {
            const point = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setWorkoutRoute(value => [...value, point]);
            if (lastPoint.current) {
              const difference = metersBetween(
                lastPoint.current,
                position.coords,
              );
              if (difference < 100)
                setWorkout(value => ({
                  ...value,
                  meters: value.meters + difference,
                }));
            }
            lastPoint.current = position.coords;
          },
        );
        setStatus('GPS activo en primer plano');
      } else
        setError('Ubicación rechazada: se registrará solamente la duración.');
    } catch (locationError) {
      setError('GPS no disponible: se registrará solamente la duración.');
    }
    workoutStart.current = Date.now();
    setWorkout(value => ({ ...value, running: true }));
    setLoading(false);
  };

  const finishWorkout = async () => {
    if (locationSub.current) locationSub.current.remove();
    locationSub.current = null;
    const record = {
      id: String(Date.now()),
      date: new Date().toISOString(),
      seconds: Math.round(workout.seconds),
      meters: Math.round(workout.meters),
      route: workoutRoute,
    };
    const next = workout.seconds ? [record, ...history].slice(0, 10) : history;
    setHistory(next);
    await writeStored('workouts', next);
    setWorkout({ seconds: 0, meters: 0, running: false });
    setWorkoutRoute([]);
    workoutBase.current = 0;
    lastPoint.current = null;
    setStatus('Entrenamiento guardado');
  };

  const loadContacts = async () => {
    setError('');
    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Contactos rechazados; escribe el número manualmente.');
        return;
      }
      const result = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
        pageSize: 50,
      });
      setContacts(
        result.data
          .filter(item => item.phoneNumbers && item.phoneNumbers.length)
          .slice(0, 8),
      );
    } catch (contactError) {
      setError('No fue posible leer los contactos.');
    }
  };

  const saveMessageDraft = async () => {
    const recipient = phone.trim();
    const text = messageText.trim();
    if (!recipient || !text) {
      setError('Selecciona un contacto y escribe un mensaje.');
      return;
    }
    const next = [
      {
        id: String(Date.now()),
        recipient,
        text,
        date: new Date().toISOString(),
      },
      ...messageDrafts,
    ].slice(0, 20);
    setMessageDrafts(next);
    setMessageText('');
    setError('');
    setStatus('Borrador guardado en el reloj');
    await writeStored('messages', next);
  };

  const toggleVoiceRecording = async () => {
    setError('');
    if (recorderState.isRecording) {
      try {
        const elapsed = recorderState.durationMillis;
        await recorder.stop();
        const sourceUri = recorder.uri || recorderState.url;
        if (!sourceUri) throw new Error('missing recording');
        const stored = await copyIntoPrivateStorage({
          sourceUri,
          kind: 'other',
          originalName: `nota-de-voz-${Date.now()}.m4a`,
        });
        const next = [
          {
            id: String(Date.now()),
            uri: stored.uri,
            size: stored.size,
            durationMillis: elapsed,
            createdAt: new Date().toISOString(),
            name: `Grabación ${voiceMemos.length + 1}`,
          },
          ...voiceMemos,
        ];
        if (!(await writeStored('voiceMemos', next))) {
          await deleteManagedFile(stored.uri);
          throw new Error('No se pudo registrar la grabación.');
        }
        setVoiceMemos(next);
        await removeManagedTemporaryFile(sourceUri);
        setStatus('Grabación guardada');
        await setAudioModeAsync({ allowsRecording: false });
      } catch (recordingError) {
        setError('No fue posible guardar la grabación.');
      }
      return;
    }
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Se necesita permiso del micrófono para grabar.');
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('');
    } catch (recordingError) {
      setError('No fue posible iniciar la grabación.');
    }
  };

  const playVoiceMemo = async memo => {
    setError('');
    try {
      if (playingMemo === memo.id && voicePlayerStatus.playing) {
        voicePlayer.pause();
        return;
      }
      if (playingMemo === memo.id) {
        voicePlayer.play();
        return;
      }
      const existing = await keepExistingManagedFiles([memo.uri]);
      if (!existing.length) {
        const next = voiceMemos.filter(item => item.id !== memo.id);
        await writeStored('voiceMemos', next);
        setVoiceMemos(next);
        throw new Error('missing voice memo');
      }
      if (music.status.playing) music.togglePlayback();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      voicePlayer.replace(memo.uri);
      voicePlayer.play();
      setPlayingMemo(memo.id);
    } catch (playbackError) {
      setError('No fue posible reproducir esta grabación.');
    }
  };

  const stopVoiceMemo = async () => {
    voicePlayer.pause();
    await voicePlayer.seekTo(0).catch(() => {});
    setPlayingMemo(null);
  };

  const renameVoiceMemo = async memo => {
    const name = memoNameDraft.trim();
    if (!name) {
      setError('Escribe un nombre para la grabación.');
      return;
    }
    const next = voiceMemos.map(item =>
      item.id === memo.id ? { ...item, name } : item,
    );
    if (!(await writeStored('voiceMemos', next))) {
      setError('No se pudo cambiar el nombre.');
      return;
    }
    setVoiceMemos(next);
    setEditingMemo(null);
    setMemoNameDraft('');
  };

  const deleteVoiceMemo = async memo => {
    if (playingMemo === memo.id) {
      voicePlayer.pause();
      setPlayingMemo(null);
    }
    const next = voiceMemos.filter(item => item.id !== memo.id);
    if (!(await writeStored('voiceMemos', next))) {
      setError('No se pudo actualizar la lista de grabaciones.');
      return;
    }
    try {
      await deleteManagedFile(memo.uri);
      setVoiceMemos(next);
    } catch (deleteError) {
      await writeStored('voiceMemos', voiceMemos).catch(() => {});
      setError('No se pudo eliminar la grabación privada.');
    }
  };

  const confirmDeleteVoiceMemo = memo => {
    Alert.alert(
      'Eliminar grabación',
      `Se borrará “${memo.name ||
        'Nueva grabación'}” del almacenamiento privado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteVoiceMemo(memo),
        },
      ],
    );
  };

  const saveNote = async () => {
    if (!noteTitle.trim() && !noteText.trim()) {
      setError('Escribe un título o contenido.');
      return;
    }
    const next = [
      {
        id: String(Date.now()),
        title: noteTitle.trim() || 'Nota',
        text: noteText.trim(),
        pinned: false,
        updatedAt: new Date().toISOString(),
      },
      ...notes,
    ];
    setNotes(next);
    setNoteTitle('');
    setNoteText('');
    setError('');
    setStatus('Nota guardada');
    await writeStored('notes', next);
  };

  const updateNotes = async next => {
    setNotes(next);
    await writeStored('notes', next);
  };

  const calculate = key => {
    if (/^\d$/.test(key) || key === '.') {
      setCalculatorDisplay(current => {
        if (
          key === '.' &&
          !calculatorReplace.current &&
          current.includes('.')
        ) {
          return current;
        }
        const next = calculatorReplace.current
          ? key === '.'
            ? '0.'
            : key
          : `${current}${key}`;
        calculatorReplace.current = false;
        return next.slice(0, 12);
      });
      return;
    }
    if (key === 'C') {
      calculatorValue.current = null;
      calculatorOperation.current = null;
      calculatorReplace.current = true;
      setCalculatorDisplay('0');
      return;
    }
    if (key === '+/-') {
      setCalculatorDisplay(current => String(Number(current) * -1));
      return;
    }
    if (key === '%') {
      setCalculatorDisplay(current => String(Number(current) / 100));
      calculatorReplace.current = true;
      return;
    }
    const applyPending = () => {
      const left = calculatorValue.current;
      const right = Number(calculatorDisplay);
      let result = right;
      if (calculatorOperation.current === '+') result = left + right;
      if (calculatorOperation.current === '−') result = left - right;
      if (calculatorOperation.current === '×') result = left * right;
      if (calculatorOperation.current === '÷')
        result = right === 0 ? 0 : left / right;
      const safe = Number.isFinite(result) ? Number(result.toPrecision(10)) : 0;
      setCalculatorDisplay(String(safe).slice(0, 12));
      return safe;
    };
    const result =
      calculatorValue.current !== null && !calculatorReplace.current
        ? applyPending()
        : Number(calculatorDisplay);
    if (key === '=') {
      calculatorValue.current = null;
      calculatorOperation.current = null;
    } else {
      calculatorValue.current = result;
      calculatorOperation.current = key;
    }
    calculatorReplace.current = true;
  };

  const requestWeather = async (latitude, longitude, place) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('weather');
    const data = await response.json();
    const firstHour = Math.max(
      0,
      data.hourly.time.findIndex(time => time >= data.current.time),
    );
    const nextWeather = {
      place,
      temp: Math.round(data.current.temperature_2m),
      apparent: Math.round(data.current.apparent_temperature),
      humidity: data.current.relative_humidity_2m,
      wind: Math.round(data.current.wind_speed_10m),
      code: data.current.weather_code,
      max: Math.round(data.daily.temperature_2m_max[0]),
      min: Math.round(data.daily.temperature_2m_min[0]),
      hourly: data.hourly.time
        .slice(firstHour, firstHour + 6)
        .map((time, index) => ({
          time,
          temperature: Math.round(
            data.hourly.temperature_2m[firstHour + index],
          ),
          code: data.hourly.weather_code[firstHour + index],
        })),
      daily: data.daily.time.map((date, index) => ({
        date,
        code: data.daily.weather_code[index],
        max: Math.round(data.daily.temperature_2m_max[index]),
        min: Math.round(data.daily.temperature_2m_min[index]),
      })),
      updatedAt: new Date().toISOString(),
    };
    setWeather(nextWeather);
    await writeStored('weather', nextWeather);
  };

  const weatherHere = async () => {
    setLoading(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Ubicación rechazada. Usa una ciudad manual.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const addresses = await Location.reverseGeocodeAsync(position.coords);
      await requestWeather(
        position.coords.latitude,
        position.coords.longitude,
        (addresses[0] && (addresses[0].city || addresses[0].district)) ||
          'Mi ubicación',
      );
    } catch (weatherError) {
      setError(
        weather
          ? 'Sin conexión. Se muestran los últimos datos guardados.'
          : 'No se pudo obtener el clima. Revisa ubicación y conexión.',
      );
    } finally {
      setLoading(false);
    }
  };

  const weatherCity = async () => {
    if (!city.trim()) {
      setError('Escribe una ciudad.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          city,
        )}&count=1&language=es`,
      );
      const data = await response.json();
      if (!data.results || !data.results.length) throw new Error('city');
      const place = data.results[0];
      await requestWeather(
        place.latitude,
        place.longitude,
        `${place.name}, ${place.country_code}`,
      );
    } catch (weatherError) {
      setError(
        weather
          ? 'No se pudo actualizar. Se muestran los últimos datos guardados.'
          : 'Ciudad no encontrada o sin conexión.',
      );
    } finally {
      setLoading(false);
    }
  };

  const locate = async () => {
    setLoading(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Permiso de ubicación rechazado.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setMapPosition(position.coords);
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          },
          450,
        );
      }
    } catch (locationError) {
      setError('No fue posible obtener tu ubicación.');
    } finally {
      setLoading(false);
    }
  };

  const addAlarm = async () => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(alarmTime.trim());
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
      setError('Usa una hora válida HH:MM.');
      return;
    }
    if (!alarmDays.length) {
      setError('Selecciona al menos un día.');
      return;
    }
    const normalizedTime = `${String(Number(match[1])).padStart(2, '0')}:${
      match[2]
    }`;
    const alarmData = {
      id: editingAlarm || String(Date.now()),
      time: normalizedTime,
      label: alarmLabel.trim() || 'Alarma',
      days: alarmDays,
      enabled: true,
      vibrate: true,
      sound: settings.sound,
    };
    const next = editingAlarm
      ? alarms.map(item => (item.id === editingAlarm ? alarmData : item))
      : [...alarms, alarmData];
    setAlarms(next);
    await writeStored('alarms', next);
    setEditingAlarm(null);
    setAlarmLabel('Alarma');
    setError('');
    setStatus(editingAlarm ? 'Alarma actualizada' : 'Alarma guardada');
  };

  const removeAlarm = item => {
    const next = alarms.filter(alarm => alarm.id !== item.id);
    setAlarms(next);
    writeStored('alarms', next);
  };

  const toggleAlarm = item => {
    const next = alarms.map(alarm =>
      alarm.id === item.id
        ? { ...alarm, enabled: alarm.enabled === false }
        : alarm,
    );
    setAlarms(next);
    writeStored('alarms', next);
  };

  const editAlarm = item => {
    setEditingAlarm(item.id);
    setAlarmTime(item.time);
    setAlarmLabel(item.label || 'Alarma');
    setAlarmDays(item.days || [0, 1, 2, 3, 4, 5, 6]);
  };

  const saveEvent = async () => {
    if (!eventTitle.trim()) {
      setError('Escribe el nombre del evento.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      setError('Usa una fecha válida AAAA-MM-DD.');
      return;
    }
    const next = editingEvent
      ? events.map(item =>
          item.id === editingEvent
            ? { ...item, title: eventTitle.trim(), date: eventDate }
            : item,
        )
      : [
          ...events,
          { id: String(Date.now()), title: eventTitle.trim(), date: eventDate },
        ];
    setEvents(next);
    setEventTitle('');
    setEventDate(new Date().toLocaleDateString('en-CA'));
    setEditingEvent(null);
    setError('');
    await writeStored('events', next);
  };

  const capture = async () => {
    if (!cameraPermission || !cameraPermission.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) setError('Permiso de cámara rechazado.');
      return;
    }
    if (!cameraReady || !cameraRef.current) return;
    try {
      setLoading(true);
      const result = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setPhoto(result.uri);
      setError('');
    } catch (cameraError) {
      setError('No se pudo tomar la fotografía.');
    } finally {
      setLoading(false);
    }
  };

  const saveCapturedPhoto = async () => {
    if (!photo) return;
    let copied;
    try {
      copied = await copyIntoPrivateStorage({
        sourceUri: photo,
        kind: 'photos',
        originalName: `photo-${Date.now()}.jpg`,
      });
      const next = [copied.uri, ...photos];
      if (!(await writeStored('photos', next))) {
        await deleteManagedFile(copied.uri);
        throw new Error('No se pudo registrar la fotografía.');
      }
      setPhotos(next);
      await removeManagedTemporaryFile(photo);
      setPhoto(null);
      setViewedPhoto(null);
      setStatus(`Fotografía privada guardada · ${formatBytes(copied.size)}`);
      setError('');
    } catch (saveError) {
      setError(
        saveError && saveError.message
          ? saveError.message
          : 'No se pudo guardar la fotografía.',
      );
    }
  };

  const discardCapturedPhoto = async () => {
    if (photo) await removeManagedTemporaryFile(photo);
    setPhoto(null);
  };

  const exportCapturedPhoto = async () => {
    if (!photo) return;
    try {
      const MediaLibrary = require('expo-media-library');
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        setError('Permiso para guardar fotografías rechazado.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(photo);
      setStatus('Fotografía guardada en el teléfono');
      setError('');
    } catch (saveError) {
      setError('No se pudo guardar la fotografía.');
    }
  };

  const choosePhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 6,
      quality: 0.8,
    });
    if (!result.canceled) {
      const selected = [];
      try {
        for (let index = 0; index < result.assets.length; index += 1) {
          const item = result.assets[index];
          const copied = await copyIntoPrivateStorage({
            sourceUri: item.uri,
            kind: 'photos',
            originalName: item.fileName || `import-${Date.now()}-${index}.jpg`,
            expectedSize: item.fileSize,
          });
          selected.push(copied.uri);
        }
        const next = [...selected, ...photos];
        if (!(await writeStored('photos', next))) {
          throw new Error('No se pudo registrar la biblioteca de Fotos.');
        }
        setPhotos(next);
        setViewedPhoto(null);
      } catch (photoError) {
        for (let index = 0; index < selected.length; index += 1) {
          await deleteManagedFile(selected[index]).catch(() => {});
        }
        setError(
          photoError && photoError.message
            ? photoError.message
            : 'No se pudieron importar las fotografías.',
        );
      }
    }
  };

  const removeViewedPhoto = async () => {
    if (viewedPhoto === null || !photos[viewedPhoto]) return;
    const uri = photos[viewedPhoto];
    const next = photos.filter((item, index) => index !== viewedPhoto);
    try {
      if (!(await writeStored('photos', next))) {
        throw new Error('No se pudo actualizar la biblioteca de Fotos.');
      }
      await deleteManagedFile(uri);
      setPhotos(next);
      setViewedPhoto(null);
      setPhotoZoomed(false);
    } catch (deleteError) {
      await writeStored('photos', photos).catch(() => {});
      setError('No se pudo eliminar la copia privada de la fotografía.');
    }
  };

  const saveSleep = async () => {
    const hours = Number(sleepHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      setError('Introduce entre 0.1 y 24 horas.');
      return;
    }
    const next = [
      { id: String(Date.now()), date: new Date().toISOString(), hours },
      ...sleep,
    ].slice(0, 14);
    setSleep(next);
    await writeStored('sleep', next);
    setError('');
    setStatus('Registro guardado');
  };

  const saveWalletCard = async () => {
    if (!walletName.trim() || !walletDetail.trim()) {
      setError('Completa el nombre y la descripción.');
      return;
    }
    const next = [
      ...walletCards,
      {
        id: String(Date.now()),
        name: walletName.trim(),
        detail: walletDetail.trim(),
      },
    ].slice(-8);
    setWalletCards(next);
    setWalletName('Pase escolar');
    setWalletDetail('Identificación');
    setError('');
    setStatus('Tarjeta guardada');
    await writeStored('walletCards', next);
  };

  const contactsView = callMode => (
    <>
      <Notice>
        {callMode
          ? 'Consulta tus contactos sin abandonar el reloj.'
          : 'Crea y conserva borradores privados dentro del reloj.'}
      </Notice>
      <Field
        value={phone}
        onChangeText={setPhone}
        placeholder={callMode ? 'Nombre o número' : 'Destinatario'}
        keyboardType="phone-pad"
      />
      <Button label="Ver contactos" color="#3a3a3c" onPress={loadContacts} />
      {!callMode && (
        <>
          <Field
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Escribe un mensaje"
            multiline
          />
          <Button
            label="Guardar borrador"
            color="#30d158"
            onPress={saveMessageDraft}
          />
        </>
      )}
      {contacts.map(item => (
        <Pressable
          key={item.id}
          style={styles.card}
          onPress={() => {
            const number = item.phoneNumbers[0].number;
            setPhone(
              callMode ? `${item.name}: ${number}` : item.name || number,
            );
            setError('');
            setStatus(`${item.name} seleccionado`);
          }}
        >
          <Ionicons name="person-circle" size={23} color="#30d158" />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.small}>{item.phoneNumbers[0].number}</Text>
          </View>
        </Pressable>
      ))}
      {!callMode && messageDrafts.length > 0 && (
        <Text style={styles.sectionTitle}>BORRADORES</Text>
      )}
      {!callMode &&
        messageDrafts.slice(0, 6).map(item => (
          <View key={item.id} style={styles.card}>
            <Ionicons name="chatbubble" size={18} color="#30d158" />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{item.recipient}</Text>
              <Text style={styles.small} numberOfLines={2}>
                {item.text}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                const next = messageDrafts.filter(
                  draft => draft.id !== item.id,
                );
                setMessageDrafts(next);
                writeStored('messages', next);
              }}
            >
              <Ionicons name="trash" size={18} color="#8e8e93" />
            </Pressable>
          </View>
        ))}
    </>
  );

  const body = () => {
    switch (app.id) {
      case 'activity': {
        const progress = Math.min(1, steps / settings.stepGoal);
        return (
          <>
            <View style={[styles.ring, { opacity: 0.25 + progress * 0.75 }]}>
              <View style={styles.ring2}>
                <View style={styles.ring3} />
              </View>
            </View>
            <Text style={styles.hero}>{steps.toLocaleString('es-MX')}</Text>
            <Text style={styles.unit}>PASOS</Text>
            <Text style={styles.secondary}>{stepInfo}</Text>
            <View style={styles.metrics}>
              <Metric
                value={`${Math.round(progress * 100)}%`}
                label="META"
                color="#ff2d55"
              />
              <Metric
                value={String(settings.stepGoal)}
                label="OBJETIVO"
                color="#b7f20a"
              />
              <Metric
                value={(steps * 0.00075).toFixed(1)}
                label="KM EST."
                color="#30d5c8"
              />
            </View>
            <Field
              value={goal}
              onChangeText={setGoal}
              placeholder="Meta de pasos"
              keyboardType="number-pad"
            />
            <Button label="Guardar meta" onPress={saveGoal} />
            <Button
              label="Guardar actividad"
              color="#ff2d55"
              onPress={saveActivity}
            />
            {activityHistory.slice(0, 3).map(item => (
              <Text key={item.id} style={styles.small}>
                {new Date(item.date).toLocaleDateString('es-MX')} ·{' '}
                {item.steps.toLocaleString('es-MX')} pasos
              </Text>
            ))}
          </>
        );
      }
      case 'heart':
        return (
          <>
            <Ionicons
              name="heart"
              size={heartActive ? 82 : 70}
              color={heartActive ? '#ff375f' : '#636366'}
            />
            <Text style={styles.hero}>—</Text>
            <Text style={styles.unit}>SIN SENSOR CARDÍACO</Text>
            {heartActive && (
              <Text style={styles.secondary}>Animación activa</Text>
            )}
            <Button
              label={heartActive ? 'Detener referencia' : 'Mostrar referencia'}
              color={heartActive ? '#ff453a' : '#30d158'}
              onPress={() => setHeartActive(value => !value)}
            />
          </>
        );
      case 'workout':
        return (
          <>
            <Text style={styles.eyebrow}>CAMINATA · GPS EN PRIMER PLANO</Text>
            <Text style={styles.timer}>{duration(workout.seconds)}</Text>
            <View style={styles.metrics}>
              <Metric
                value={(workout.meters / 1000).toFixed(2)}
                label="KM GPS"
                color="#fff"
              />
              <Metric
                value={String(Math.round(workout.meters * 0.055))}
                label="CAL EST."
                color="#b7f20a"
              />
            </View>
            {workoutRoute.length > 1 && (
              <MapView
                style={styles.workoutMap}
                region={{
                  latitude: workoutRoute[workoutRoute.length - 1].latitude,
                  longitude: workoutRoute[workoutRoute.length - 1].longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Polyline
                  coordinates={workoutRoute}
                  strokeColor="#b7f20a"
                  strokeWidth={4}
                />
              </MapView>
            )}
            <Button
              label={
                loading
                  ? 'Preparando…'
                  : workout.running
                  ? 'Pausar'
                  : workout.seconds
                  ? 'Continuar'
                  : 'Iniciar'
              }
              disabled={loading}
              color={workout.running ? '#ff9f0a' : '#30d158'}
              onPress={controlWorkout}
            />
            <Button
              label="Finalizar y guardar"
              color="#ff453a"
              onPress={finishWorkout}
            />
            {history.slice(0, 3).map(item => (
              <Text key={item.id} style={styles.small}>
                {new Date(item.date).toLocaleDateString('es-MX')} ·{' '}
                {duration(item.seconds)} · {(item.meters / 1000).toFixed(2)} km
              </Text>
            ))}
          </>
        );
      case 'messages':
        return contactsView(false);
      case 'phone':
        return contactsView(true);
      case 'weather': {
        const description = weather && weatherText(weather.code);
        return (
          <>
            {weather ? (
              <>
                <Text style={styles.city}>{weather.place}</Text>
                <Ionicons name={description[1]} size={68} color="#ffd60a" />
                <Text style={styles.temperature}>{weather.temp}°</Text>
                <Text style={styles.secondary}>
                  {description[0]} · Sensación {weather.apparent}° · Máx.{' '}
                  {weather.max}° · Mín. {weather.min}°
                </Text>
                <View style={styles.metrics}>
                  <Metric
                    value={`${weather.humidity || '—'}%`}
                    label="HUMEDAD"
                    color="#64d2ff"
                  />
                  <Metric
                    value={`${weather.wind || '—'}`}
                    label="KM/H VIENTO"
                    color="#ffffff"
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.forecastScroll}
                >
                  {(weather.hourly || []).map(hour => (
                    <View key={hour.time} style={styles.forecastCard}>
                      <Text style={styles.small}>
                        {new Date(hour.time).toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Ionicons
                        name={weatherText(hour.code)[1]}
                        size={21}
                        color="#ffd60a"
                      />
                      <Text style={styles.forecastTemperature}>
                        {hour.temperature}°
                      </Text>
                    </View>
                  ))}
                </ScrollView>
                {(weather.daily || []).map(day => (
                  <View key={day.date} style={styles.forecastDay}>
                    <Text style={styles.forecastDayName}>
                      {new Date(
                        `${day.date}T12:00:00`,
                      ).toLocaleDateString('es-MX', { weekday: 'short' })}
                    </Text>
                    <Ionicons
                      name={weatherText(day.code)[1]}
                      size={20}
                      color="#ffd60a"
                    />
                    <Text style={styles.forecastRange}>
                      {day.max}° / {day.min}°
                    </Text>
                  </View>
                ))}
                <Text style={styles.small}>
                  Actualizado{' '}
                  {weather.updatedAt
                    ? new Date(weather.updatedAt).toLocaleString('es-MX')
                    : 'recientemente'}
                </Text>
              </>
            ) : (
              <Notice>Consulta el clima actualizado de tu ubicación.</Notice>
            )}
            <Button
              label={loading ? 'Consultando…' : 'Usar mi ubicación'}
              disabled={loading}
              onPress={weatherHere}
            />
            <Field
              value={city}
              onChangeText={setCity}
              placeholder="Ciudad alternativa"
            />
            <Button
              label="Buscar ciudad"
              color="#3a3a3c"
              disabled={loading}
              onPress={weatherCity}
            />
          </>
        );
      }
      case 'music': {
        const hasTrack = Boolean(music.currentTrack);
        const progress = music.status.duration
          ? Math.min(1, music.status.currentTime / music.status.duration)
          : 0;
        const visibleTracks = musicFavoritesOnly
          ? music.tracks.filter(track => track.favorite)
          : music.tracks;
        return (
          <>
            <View style={styles.album}>
              <Ionicons name="musical-notes" size={58} color="#fff" />
            </View>
            <Text style={styles.city} numberOfLines={1}>
              {hasTrack ? music.currentTrack.title : 'Tu música'}
            </Text>
            <Text style={styles.secondary} numberOfLines={1}>
              {hasTrack
                ? music.currentTrack.artist
                : 'Importa un archivo de audio'}
            </Text>
            <View style={styles.musicProgressTrack}>
              <View
                style={[
                  styles.musicProgressFill,
                  { width: `${progress * 100}%` },
                ]}
              />
            </View>
            <View style={styles.musicTimeRow}>
              <Text style={styles.small}>
                {duration(music.status.currentTime)}
              </Text>
              <Text style={styles.small}>
                {duration(music.status.duration)}
              </Text>
            </View>
            <Text style={styles.small}>
              {music.status.isBuffering
                ? 'Cargando…'
                : music.status.playing
                ? 'Reproduciendo'
                : hasTrack
                ? 'En pausa'
                : 'Biblioteca vacía'}
            </Text>
            <View style={styles.musicMainControls}>
              <Pressable
                disabled={!hasTrack}
                onPress={music.previous}
                style={!hasTrack && styles.disabledControl}
              >
                <Ionicons name="play-skip-back" size={28} color="#fff" />
              </Pressable>
              <Pressable
                disabled={!music.tracks.length}
                onPress={music.togglePlayback}
                style={!music.tracks.length && styles.disabledControl}
              >
                <Ionicons
                  name={music.status.playing ? 'pause-circle' : 'play-circle'}
                  size={66}
                  color="#fff"
                />
              </Pressable>
              <Pressable
                disabled={!hasTrack}
                onPress={music.next}
                style={!hasTrack && styles.disabledControl}
              >
                <Ionicons name="play-skip-forward" size={28} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.playerControls}>
              <Pressable
                disabled={!hasTrack}
                onPress={() => music.seekBy(-15)}
                style={!hasTrack && styles.disabledControl}
              >
                <Text style={styles.musicAction}>−15</Text>
              </Pressable>
              <Pressable
                onPress={() => music.setShuffle(value => !value)}
                style={!music.tracks.length && styles.disabledControl}
                disabled={!music.tracks.length}
              >
                <Ionicons
                  name="shuffle"
                  size={22}
                  color={music.shuffle ? '#fa2d55' : '#8e8e93'}
                />
              </Pressable>
              <Pressable
                onPress={music.cycleRepeat}
                style={!music.tracks.length && styles.disabledControl}
                disabled={!music.tracks.length}
              >
                <Ionicons
                  name={music.repeat === 'one' ? 'repeat' : 'repeat-outline'}
                  size={22}
                  color={music.repeat === 'off' ? '#8e8e93' : '#fa2d55'}
                />
                {music.repeat === 'one' && (
                  <Text style={styles.repeatOne}>1</Text>
                )}
              </Pressable>
              <Pressable
                disabled={!hasTrack}
                onPress={() => music.seekBy(15)}
                style={!hasTrack && styles.disabledControl}
              >
                <Text style={styles.musicAction}>+15</Text>
              </Pressable>
            </View>
            <View style={styles.playerControls}>
              <Pressable
                onPress={() =>
                  music.setVolume(value => Math.max(0, value - 0.1))
                }
              >
                <Ionicons name="volume-low" size={22} color="#8e8e93" />
              </Pressable>
              <Text style={styles.small}>
                Volumen {Math.round(music.volume * 100)}%
              </Text>
              <Pressable
                onPress={() =>
                  music.setVolume(value => Math.min(1, value + 0.1))
                }
              >
                <Ionicons name="volume-high" size={22} color="#fff" />
              </Pressable>
            </View>
            {music.error ? (
              <Text style={styles.error}>{music.error}</Text>
            ) : null}
            <Button
              label={music.importing ? 'Importando…' : 'Añadir canciones'}
              disabled={music.importing}
              onPress={music.importTracks}
            />
            <View style={styles.musicLibraryTabs}>
              <Pressable
                onPress={() => setMusicFavoritesOnly(false)}
                style={[
                  styles.musicTab,
                  !musicFavoritesOnly && styles.musicTabActive,
                ]}
              >
                <Text style={styles.musicTabText}>Todas</Text>
              </Pressable>
              <Pressable
                onPress={() => setMusicFavoritesOnly(true)}
                style={[
                  styles.musicTab,
                  musicFavoritesOnly && styles.musicTabActive,
                ]}
              >
                <Text style={styles.musicTabText}>Favoritas</Text>
              </Pressable>
            </View>
            {music.tracks.length > 0 && (
              <Text style={styles.sectionTitle}>BIBLIOTECA</Text>
            )}
            {visibleTracks.map(track => {
              const index = music.tracks.findIndex(
                item => item.id === track.id,
              );
              return (
                <View
                  key={track.id}
                  style={[
                    styles.card,
                    index === music.currentIndex && styles.activeTrack,
                  ]}
                >
                  <Pressable
                    style={styles.musicTrackMain}
                    onPress={() => music.playAt(index)}
                  >
                    <Ionicons
                      name={
                        index === music.currentIndex && music.status.playing
                          ? 'volume-high'
                          : 'musical-note'
                      }
                      size={19}
                      color="#fa2d55"
                    />
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {track.title}
                      </Text>
                      <Text style={styles.small} numberOfLines={1}>
                        {track.artist}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => music.toggleFavorite(track.id)}>
                    <Ionicons
                      name={track.favorite ? 'heart' : 'heart-outline'}
                      size={19}
                      color="#fa2d55"
                    />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Eliminar canción', track.title, [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Eliminar',
                          style: 'destructive',
                          onPress: () => music.deleteTrack(track.id),
                        },
                      ])
                    }
                  >
                    <Ionicons name="trash" size={18} color="#8e8e93" />
                  </Pressable>
                </View>
              );
            })}
            {musicFavoritesOnly && !visibleTracks.length && (
              <Text style={styles.secondary}>Aún no tienes favoritas</Text>
            )}
          </>
        );
      }
      case 'maps':
        return (
          <>
            {mapPosition ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: mapPosition.latitude,
                  longitude: mapPosition.longitude,
                  latitudeDelta: 0.012,
                  longitudeDelta: 0.012,
                }}
                showsUserLocation
              >
                <Marker coordinate={mapPosition} title="Mi ubicación" />
                {history[0] &&
                  history[0].route &&
                  history[0].route.length > 1 && (
                    <Polyline
                      coordinates={history[0].route}
                      strokeColor="#0a84ff"
                      strokeWidth={4}
                    />
                  )}
              </MapView>
            ) : (
              <Ionicons name="map" size={76} color="#64d2ff" />
            )}
            <Button
              label={loading ? 'Localizando…' : 'Centrar mi ubicación'}
              disabled={loading}
              onPress={locate}
            />
            {mapPosition && (
              <Text style={styles.small}>
                Precisión aproximada: {Math.round(mapPosition.accuracy || 0)} m
              </Text>
            )}
          </>
        );
      case 'timer':
        return (
          <>
            <Text style={styles.timer}>{duration(timer)}</Text>
            <View style={styles.row}>
              <Button
                label="−1 min"
                color="#3a3a3c"
                onPress={() => setTimer(value => Math.max(0, value - 60))}
              />
              <Button
                label="+1 min"
                color="#3a3a3c"
                onPress={() => setTimer(value => value + 60)}
              />
            </View>
            <Button
              label={
                timerEnd ? 'Pausar' : timerPaused ? 'Continuar' : 'Iniciar'
              }
              color="#ff9f0a"
              disabled={!timer}
              onPress={() => {
                if (timerEnd) {
                  setTimerEnd(null);
                  setTimerPaused(true);
                } else {
                  setTimerEnd(Date.now() + timer * 1000);
                  setTimerPaused(false);
                }
              }}
            />
            <Button
              label="Reiniciar"
              color="#3a3a3c"
              onPress={() => {
                setTimerEnd(null);
                setTimer(300);
                setTimerPaused(false);
              }}
            />
          </>
        );
      case 'alarm':
        return (
          <>
            <Field
              value={alarmTime}
              onChangeText={setAlarmTime}
              placeholder="07:30"
              keyboardType="numbers-and-punctuation"
            />
            <Field
              value={alarmLabel}
              onChangeText={setAlarmLabel}
              placeholder="Etiqueta"
            />
            <View style={styles.dayRow}>
              {[
                ['L', 1],
                ['M', 2],
                ['X', 3],
                ['J', 4],
                ['V', 5],
                ['S', 6],
                ['D', 0],
              ].map(([label, day]) => (
                <Pressable
                  key={label}
                  onPress={() =>
                    setAlarmDays(value =>
                      value.includes(day)
                        ? value.filter(item => item !== day)
                        : [...value, day],
                    )
                  }
                  style={[
                    styles.dayButton,
                    alarmDays.includes(day) && styles.dayButtonActive,
                  ]}
                >
                  <Text style={styles.dayText}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              label={editingAlarm ? 'Guardar cambios' : 'Añadir alarma'}
              color="#ff9f0a"
              onPress={addAlarm}
            />
            {alarms.map(item => (
              <View key={item.id} style={styles.card}>
                <Pressable onPress={() => toggleAlarm(item)}>
                  <Ionicons
                    name={item.enabled === false ? 'alarm-outline' : 'alarm'}
                    size={22}
                    color={item.enabled === false ? '#636366' : '#ff9f0a'}
                  />
                </Pressable>
                <Pressable style={styles.flex} onPress={() => editAlarm(item)}>
                  <Text style={styles.cardTitle}>
                    {item.time} · {item.label || 'Alarma'}
                  </Text>
                  <Text style={styles.small}>
                    {(item.days || [0, 1, 2, 3, 4, 5, 6]).length === 7
                      ? 'Todos los días'
                      : 'Días seleccionados'}{' '}
                    · {item.enabled === false ? 'Desactivada' : 'Activada'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => removeAlarm(item)}>
                  <Ionicons name="trash" size={20} color="#ff453a" />
                </Pressable>
              </View>
            ))}
          </>
        );
      case 'calendar':
        return (
          <>
            <Text style={styles.calendar}>{new Date().getDate()}</Text>
            <Text style={styles.city}>
              {new Date().toLocaleDateString('es-MX', {
                weekday: 'long',
                month: 'long',
              })}
            </Text>
            <Field
              value={eventTitle}
              onChangeText={setEventTitle}
              placeholder="Evento local"
            />
            <Field
              value={eventDate}
              onChangeText={setEventDate}
              placeholder="AAAA-MM-DD"
              keyboardType="numbers-and-punctuation"
            />
            <Button
              label={editingEvent ? 'Guardar cambio' : 'Crear evento'}
              onPress={saveEvent}
            />
            {events.map(item => (
              <View key={item.id} style={styles.card}>
                <Pressable
                  style={styles.flex}
                  onPress={() => {
                    setEditingEvent(item.id);
                    setEventTitle(item.title);
                    setEventDate(
                      item.date || new Date().toLocaleDateString('en-CA'),
                    );
                  }}
                >
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.small}>
                    {item.date || 'Sin fecha'} · Toca para editar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const next = events.filter(event => event.id !== item.id);
                    setEvents(next);
                    writeStored('events', next);
                  }}
                >
                  <Ionicons name="trash" size={20} color="#ff453a" />
                </Pressable>
              </View>
            ))}
          </>
        );
      case 'camera':
        return (
          <>
            {photo ? (
              <>
                <Image source={{ uri: photo }} style={styles.preview} />
                <View style={styles.row}>
                  <Button
                    label="Repetir"
                    color="#3a3a3c"
                    onPress={discardCapturedPhoto}
                  />
                  <Button label="Guardar" onPress={saveCapturedPhoto} />
                </View>
                {!IS_EXPO_GO && (
                  <Button
                    label="Guardar en teléfono"
                    color="#3a3a3c"
                    onPress={exportCapturedPhoto}
                  />
                )}
              </>
            ) : cameraPermission && cameraPermission.granted ? (
              <>
                <View style={styles.cameraFrame}>
                  <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing={cameraFacing}
                    flash={cameraFlash}
                    onCameraReady={() => setCameraReady(true)}
                    onMountError={() =>
                      setError('No se pudo iniciar la cámara.')
                    }
                  />
                  <View style={styles.cameraControls}>
                    <Pressable
                      onPress={() =>
                        setCameraFacing(value =>
                          value === 'back' ? 'front' : 'back',
                        )
                      }
                      style={styles.cameraTool}
                    >
                      <Ionicons name="camera-reverse" size={23} color="#fff" />
                    </Pressable>
                    <Pressable
                      disabled={!cameraReady || loading}
                      onPress={capture}
                      style={styles.shutter}
                    />
                    <Pressable
                      onPress={() =>
                        setCameraFlash(value =>
                          value === 'off' ? 'on' : 'off',
                        )
                      }
                      style={styles.cameraTool}
                    >
                      <Ionicons
                        name={cameraFlash === 'on' ? 'flash' : 'flash-off'}
                        size={23}
                        color="#fff"
                      />
                    </Pressable>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="camera" size={82} color="#8e8e93" />
                <Button
                  label="Permitir cámara"
                  onPress={requestCameraPermission}
                />
              </>
            )}
          </>
        );
      case 'photos': {
        const displayPhotos = photos.map(uri => ({ uri }));
        return (
          <>
            {viewedPhoto === null ? (
              displayPhotos.length ? (
                <View style={styles.gallery}>
                  {displayPhotos.map((source, index) => (
                    <Pressable
                      key={photos[index]}
                      onPress={() => setViewedPhoto(index)}
                    >
                      <Image source={source} style={styles.photo} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyLibrary}>
                  <Ionicons name="images-outline" size={58} color="#636366" />
                  <Text style={styles.secondary}>
                    Tu biblioteca privada está vacía
                  </Text>
                </View>
              )
            ) : (
              <>
                <Pressable onPress={() => setPhotoZoomed(value => !value)}>
                  <Image
                    source={displayPhotos[viewedPhoto]}
                    resizeMode="contain"
                    style={
                      photoZoomed
                        ? styles.photoViewerZoomed
                        : styles.photoViewer
                    }
                  />
                </Pressable>
                <View style={styles.row}>
                  <Button
                    label="Anterior"
                    color="#3a3a3c"
                    onPress={() =>
                      setViewedPhoto(
                        value =>
                          (value - 1 + displayPhotos.length) %
                          displayPhotos.length,
                      )
                    }
                  />
                  <Button
                    label="Siguiente"
                    color="#3a3a3c"
                    onPress={() =>
                      setViewedPhoto(
                        value => (value + 1) % displayPhotos.length,
                      )
                    }
                  />
                </View>
                <Button
                  label="Volver a miniaturas"
                  onPress={() => {
                    setViewedPhoto(null);
                    setPhotoZoomed(false);
                  }}
                />
                {photos.length > 0 && (
                  <Button
                    label="Eliminar fotografía"
                    color="#ff453a"
                    onPress={removeViewedPhoto}
                  />
                )}
              </>
            )}
            <Button label="Elegir de la galería" onPress={choosePhotos} />
          </>
        );
      }
      case 'wallet':
        return (
          <>
            <StripeWalletPayments sideButtonSignal={sideButtonSignal} />
            {walletCards.map(item => (
              <View key={item.id} style={styles.wallet}>
                <Ionicons name="card" size={30} color="#fff" />
                <View style={styles.flex}>
                  <Text style={styles.walletTitle}>{item.name}</Text>
                  <Text style={styles.small}>{item.detail}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    const next = walletCards.filter(
                      card => card.id !== item.id,
                    );
                    setWalletCards(next);
                    writeStored('walletCards', next);
                  }}
                >
                  <Ionicons name="trash" size={19} color="#fff" />
                </Pressable>
              </View>
            ))}
            <Field
              value={walletName}
              onChangeText={setWalletName}
              placeholder="Nombre de la tarjeta"
            />
            <Field
              value={walletDetail}
              onChangeText={setWalletDetail}
              placeholder="Descripción"
            />
            <Button label="Añadir tarjeta" onPress={saveWalletCard} />
          </>
        );
      case 'compass':
        return (
          <>
            <View style={styles.compass}>
              <Text style={styles.north}>N</Text>
              <Ionicons
                name="navigate"
                size={80}
                color="#ff453a"
                style={{ transform: [{ rotate: `${heading || 0}deg` }] }}
              />
            </View>
            <Text style={styles.hero}>
              {heading === null ? '—' : `${heading}°`}
            </Text>
            {heading !== null && (
              <Text style={styles.unit}>{cardinalDirection(heading)}</Text>
            )}
            <Text style={styles.secondary}>
              {compassAvailable === false
                ? 'Sensor no disponible'
                : heading === null
                ? 'Calibrando… mueve el teléfono en forma de 8'
                : compassReliable
                ? 'Orientación estable'
                : 'Aleja el teléfono de objetos metálicos y calibra en forma de 8'}
            </Text>
          </>
        );
      case 'settings': {
        const storageEnvironment = getStorageEnvironment();
        return (
          <>
            <Pressable
              style={styles.setting}
              onPress={() =>
                persistSettings({ ...settings, sound: !settings.sound })
              }
            >
              <Text style={styles.cardTitle}>Sonidos de la app</Text>
              <Text style={styles.settingValue}>
                {settings.sound ? 'Sí' : 'No'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.setting}
              onPress={() =>
                persistSettings({ ...settings, haptics: !settings.haptics })
              }
            >
              <Text style={styles.cardTitle}>Hápticos</Text>
              <Text style={styles.settingValue}>
                {settings.haptics ? 'Sí' : 'No'}
              </Text>
            </Pressable>
            <View style={styles.setting}>
              <Text style={styles.cardTitle}>Meta de pasos</Text>
              <Text style={styles.settingValue}>{settings.stepGoal}</Text>
            </View>
            <Pressable
              style={styles.setting}
              onPress={() => {
                const current = settings.brightness || 1;
                let brightness = 1;
                if (current > 0.85) brightness = 0.72;
                else if (current > 0.65) brightness = 0.5;
                persistSettings({ ...settings, brightness });
              }}
            >
              <Text style={styles.cardTitle}>Brillo</Text>
              <Text style={styles.settingValue}>
                {Math.round((settings.brightness || 1) * 100)}%
              </Text>
            </Pressable>
            <Field
              value={goal}
              onChangeText={setGoal}
              placeholder="Meta de pasos"
              keyboardType="number-pad"
            />
            <Button label="Guardar meta" onPress={saveGoal} />
            <Pressable
              style={styles.setting}
              onPress={() =>
                persistSettings({ ...settings, alwaysOn: !settings.alwaysOn })
              }
            >
              <Text style={styles.cardTitle}>Siempre activa virtual</Text>
              <Text style={styles.settingValue}>
                {settings.alwaysOn ? 'Sí' : 'No'}
              </Text>
            </Pressable>
            <Text style={styles.sectionTitle}>CÓDIGO</Text>
            <Field
              value={passcodeDraft}
              onChangeText={value =>
                setPasscodeDraft(value.replace(/\D/g, '').slice(0, 4))
              }
              placeholder="Código de 4 dígitos"
              keyboardType="number-pad"
            />
            <Button
              label={
                settings.passcodeEnabled ? 'Cambiar código' : 'Activar código'
              }
              onPress={() => {
                if (passcodeDraft.length !== 4) {
                  setError('El código debe tener 4 dígitos.');
                  return;
                }
                persistSettings({
                  ...settings,
                  passcodeEnabled: true,
                  passcode: passcodeDraft,
                });
                setError('');
                setStatus('Código guardado');
              }}
            />
            {settings.passcodeEnabled && (
              <Button
                label="Desactivar código"
                color="#3a3a3c"
                onPress={() => {
                  setPasscodeDraft('');
                  persistSettings({
                    ...settings,
                    passcodeEnabled: false,
                    passcode: '',
                  });
                }}
              />
            )}
            <Text style={styles.sectionTitle}>ALMACENAMIENTO</Text>
            {storageReport ? (
              <View style={styles.storageCard}>
                <View style={styles.storageRow}>
                  <Text style={styles.cardTitle}>Fotos</Text>
                  <Text style={styles.settingValue}>
                    {formatBytes(storageReport.photos)} ·{' '}
                    {storageReport.counts.photos}
                  </Text>
                </View>
                <View style={styles.storageRow}>
                  <Text style={styles.cardTitle}>Música</Text>
                  <Text style={styles.settingValue}>
                    {formatBytes(storageReport.music)} ·{' '}
                    {storageReport.counts.music}
                  </Text>
                </View>
                <View style={styles.storageRow}>
                  <Text style={styles.cardTitle}>Descargas</Text>
                  <Text style={styles.settingValue}>
                    {formatBytes(storageReport.downloads)} ·{' '}
                    {storageReport.counts.downloads}
                  </Text>
                </View>
                <View style={styles.storageRow}>
                  <Text style={styles.cardTitle}>Otros archivos</Text>
                  <Text style={styles.settingValue}>
                    {formatBytes(storageReport.other)}
                  </Text>
                </View>
                <View style={styles.storageRow}>
                  <Text style={styles.cardTitle}>Caché administrada</Text>
                  <Text style={styles.settingValue}>
                    {formatBytes(storageReport.cache)}
                  </Text>
                </View>
                <View style={[styles.storageRow, styles.storageTotal]}>
                  <Text style={styles.storageTotalText}>Total medido</Text>
                  <Text style={styles.storageTotalText}>
                    {formatBytes(storageReport.total)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.secondary}>
                {storageLoading ? 'Midiendo archivos…' : 'Sin medición'}
              </Text>
            )}
            <Button
              label={storageLoading ? 'Midiendo…' : 'Actualizar medición'}
              disabled={storageLoading}
              onPress={() => {
                setStorageLoading(true);
                getManagedStorageReport()
                  .then(report => {
                    setStorageReport(report);
                    setError('');
                  })
                  .catch(() =>
                    setError('No se pudo medir el almacenamiento privado.'),
                  )
                  .finally(() => setStorageLoading(false));
              }}
            />
            <Notice>
              {storageEnvironment.runtime === 'expo-go'
                ? 'Expo Go: archivos reales dentro del espacio privado de Expo Go.'
                : `APK: Android/data activo para ${storageEnvironment.configuredApplicationId ||
                    'la aplicación'}.`}
            </Notice>
            <Text style={styles.storageFootnote}>
              Entrenos, alarmas y ajustes usan almacenamiento estructurado
              privado. Su archivo físico no es medible desde la API JavaScript
              de Expo, por eso no se inventa una cifra ni se suma al total
              anterior.
            </Text>
            {storageEnvironment.runtime !== 'expo-go' && (
              <Text style={styles.storageFootnote}>
                OBB:{' '}
                {storageEnvironment.androidObbAvailable
                  ? storageEnvironment.androidObbExists
                    ? 'directorio disponible; reservado para expansiones.'
                    : 'ubicación verificada; no creada porque no hay expansiones.'
                  : 'almacenamiento externo no disponible.'}
              </Text>
            )}
          </>
        );
      }
      case 'sleep': {
        const average = sleep.length
          ? sleep.reduce((sum, item) => sum + item.hours, 0) / sleep.length
          : 0;
        return (
          <>
            <Ionicons name="moon" size={68} color="#7d7aff" />
            <Text style={styles.hero}>
              {average ? `${average.toFixed(1)} h` : 'Sin datos'}
            </Text>
            <Text style={styles.secondary}>Promedio de registros manuales</Text>
            <Field
              value={sleepHours}
              onChangeText={setSleepHours}
              placeholder="Horas dormidas"
              keyboardType="decimal-pad"
            />
            <Button
              label="Guardar registro"
              color="#5856d6"
              onPress={saveSleep}
            />
            {sleep.slice(0, 5).map(item => (
              <View key={item.id} style={styles.card}>
                <Text style={[styles.small, styles.flex]}>
                  {new Date(item.date).toLocaleDateString('es-MX')} ·{' '}
                  {item.hours} horas
                </Text>
                <Pressable
                  onPress={() => {
                    const next = sleep.filter(record => record.id !== item.id);
                    setSleep(next);
                    writeStored('sleep', next);
                  }}
                >
                  <Ionicons name="trash" size={18} color="#8e8e93" />
                </Pressable>
              </View>
            ))}
          </>
        );
      }
      case 'find':
        return (
          <>
            <Ionicons name="phone-portrait" size={80} color="#34c759" />
            <Text style={styles.secondary}>Alerta del dispositivo actual</Text>
            <Button
              label="Alertar este teléfono"
              color="#34c759"
              onPress={() => {
                [0, 450, 900].forEach(delay =>
                  setTimeout(
                    () =>
                      Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Warning,
                      ).catch(() => {}),
                    delay,
                  ),
                );
                Alert.alert(
                  'Encontrar dispositivo',
                  'Alerta activa en este teléfono.',
                );
              }}
            />
          </>
        );
      case 'stopwatch':
        return (
          <>
            <View style={styles.stopwatchTabs}>
              {['digital', 'analog', 'graph', 'hybrid'].map(view => (
                <Pressable
                  key={view}
                  onPress={() => stopwatchState.setView(view)}
                  style={[
                    styles.stopwatchTab,
                    stopwatchState.view === view && styles.stopwatchTabActive,
                  ]}
                >
                  <Text style={styles.stopwatchTabText}>{view}</Text>
                </Pressable>
              ))}
            </View>
            <StopwatchVisual
              elapsed={stopwatchState.elapsed}
              laps={stopwatchState.laps}
              view={stopwatchState.view}
            />
            <Button
              label={stopwatchState.running ? 'Detener' : 'Iniciar'}
              color={stopwatchState.running ? '#ff453a' : '#30d158'}
              onPress={stopwatchState.toggle}
            />
            <Button
              label="Vuelta"
              color="#0a84ff"
              disabled={!stopwatchState.running}
              onPress={stopwatchState.lap}
            />
            <Button
              label="Restablecer"
              color="#3a3a3c"
              onPress={stopwatchState.reset}
            />
            {stopwatchState.laps.map((lap, index) => (
              <View key={lap.id} style={styles.lapRow}>
                <Text style={styles.small}>
                  Vuelta {stopwatchState.laps.length - index}
                </Text>
                <Text style={styles.lapTime}>{duration(lap.time)}</Text>
              </View>
            ))}
          </>
        );
      case 'reminders':
        return <RemindersApp />;
      case 'now-playing':
        return <NowPlayingApp />;
      case 'shortcuts':
        return <ShortcutsApp onExecute={onShortcutAction} />;
      case 'walkie-talkie':
        return <WalkieTalkieApp theaterMode={settings.theaterMode} />;
      case 'voice-memos':
        return (
          <>
            <Pressable
              accessibilityLabel={
                recorderState.isRecording ? 'Detener grabación' : 'Grabar'
              }
              onPress={toggleVoiceRecording}
              style={[
                styles.recordButton,
                recorderState.isRecording && styles.recordButtonActive,
              ]}
            >
              <View
                style={
                  recorderState.isRecording
                    ? styles.stopSquare
                    : styles.recordDot
                }
              />
            </Pressable>
            <Text style={styles.hero}>
              {duration((recorderState.durationMillis || 0) / 1000)}
            </Text>
            <Text style={styles.unit}>
              {recorderState.isRecording ? 'GRABANDO' : 'NOTAS DE VOZ'}
            </Text>
            {voiceMemos.map(memo => (
              <View key={memo.id} style={[styles.card, styles.voiceMemoCard]}>
                <View style={styles.voiceMemoRow}>
                  <Pressable
                    accessibilityLabel={`Reproducir ${memo.name ||
                      'Nueva grabación'}`}
                    onPress={() => playVoiceMemo(memo)}
                  >
                    <Ionicons
                      name={
                        playingMemo === memo.id && voicePlayerStatus.playing
                          ? 'pause'
                          : 'play'
                      }
                      size={24}
                      color="#ff453a"
                    />
                  </Pressable>
                  <View style={styles.flex}>
                    {editingMemo === memo.id ? (
                      <View style={styles.memoRenameRow}>
                        <TextInput
                          autoFocus
                          maxLength={48}
                          onChangeText={setMemoNameDraft}
                          onSubmitEditing={() => renameVoiceMemo(memo)}
                          placeholder="Nombre"
                          placeholderTextColor="#636366"
                          style={styles.memoNameInput}
                          value={memoNameDraft}
                        />
                        <Pressable
                          accessibilityLabel="Guardar nombre"
                          onPress={() => renameVoiceMemo(memo)}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={21}
                            color="#30d158"
                          />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onLongPress={() => {
                          setEditingMemo(memo.id);
                          setMemoNameDraft(memo.name || 'Nueva grabación');
                        }}
                      >
                        <Text style={styles.cardTitle}>
                          {memo.name || 'Nueva grabación'}
                        </Text>
                      </Pressable>
                    )}
                    <Text style={styles.small}>
                      {new Date(memo.createdAt).toLocaleString('es-MX')} ·{' '}
                      {playingMemo === memo.id
                        ? duration(voicePlayerStatus.currentTime || 0)
                        : duration((memo.durationMillis || 0) / 1000)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Cambiar nombre"
                    onPress={() => {
                      setEditingMemo(memo.id);
                      setMemoNameDraft(memo.name || 'Nueva grabación');
                    }}
                  >
                    <Ionicons name="pencil" size={17} color="#8e8e93" />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Eliminar grabación"
                    onPress={() => confirmDeleteVoiceMemo(memo)}
                  >
                    <Ionicons name="trash" size={18} color="#8e8e93" />
                  </Pressable>
                </View>
                {playingMemo === memo.id && (
                  <View style={styles.memoPlaybackArea}>
                    <View style={styles.memoProgressTrack}>
                      <View
                        style={[
                          styles.memoProgressFill,
                          {
                            width: `${Math.min(
                              100,
                              ((voicePlayerStatus.currentTime || 0) /
                                Math.max(
                                  voicePlayerStatus.duration ||
                                    (memo.durationMillis || 0) / 1000,
                                  0.1,
                                )) *
                                100,
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Pressable
                      accessibilityLabel="Detener reproducción"
                      onPress={stopVoiceMemo}
                    >
                      <Ionicons name="stop" size={17} color="#ff453a" />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </>
        );
      case 'calculator': {
        const keys = [
          'C',
          '+/-',
          '%',
          '÷',
          '7',
          '8',
          '9',
          '×',
          '4',
          '5',
          '6',
          '−',
          '1',
          '2',
          '3',
          '+',
          '0',
          '.',
          '=',
        ];
        return (
          <>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={styles.calculatorDisplay}
            >
              {calculatorDisplay}
            </Text>
            <View style={styles.calculatorGrid}>
              {keys.map(key => (
                <Pressable
                  key={key}
                  onPress={() => calculate(key)}
                  style={[
                    styles.calculatorKey,
                    key === '0' && styles.calculatorZero,
                    ['÷', '×', '−', '+', '='].includes(key) &&
                      styles.calculatorOperator,
                  ]}
                >
                  <Text style={styles.calculatorKeyText}>{key}</Text>
                </Pressable>
              ))}
            </View>
          </>
        );
      }
      case 'notes': {
        const sortedNotes = [...notes].sort(
          (a, b) => Number(b.pinned) - Number(a.pinned),
        );
        return (
          <>
            <Field
              value={noteTitle}
              onChangeText={setNoteTitle}
              placeholder="Título"
            />
            <Field
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Escribe una nota"
              multiline
            />
            <Button label="Guardar nota" color="#ffd60a" onPress={saveNote} />
            {sortedNotes.map(note => (
              <View key={note.id} style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <Ionicons
                    name={note.pinned ? 'pin' : 'document-text'}
                    size={17}
                    color="#ffd60a"
                  />
                  <Text style={styles.cardTitle}>{note.title}</Text>
                  <Pressable
                    onPress={() =>
                      updateNotes(
                        notes.map(item =>
                          item.id === note.id
                            ? { ...item, pinned: !item.pinned }
                            : item,
                        ),
                      )
                    }
                  >
                    <Ionicons name="pin-outline" size={17} color="#8e8e93" />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      updateNotes(notes.filter(item => item.id !== note.id))
                    }
                  >
                    <Ionicons name="trash" size={17} color="#8e8e93" />
                  </Pressable>
                </View>
                {!!note.text && (
                  <Text style={styles.noteText}>{note.text}</Text>
                )}
              </View>
            ))}
          </>
        );
      }
      case 'world-clock':
      case 'mindfulness':
      case 'noise':
      case 'medications':
      case 'waypoints':
      case 'astronomy':
      case 'handwashing':
      case 'camera-remote':
        return <AdditionalWatchApps app={app} settings={settings} />;
      case 'games':
        return <GamesCenter settings={settings} />;
      default:
        return <Notice>Función no disponible.</Notice>;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Volver"
          onPress={() => {
            if (settings.haptics) Haptics.selectionAsync().catch(() => {});
            onClose();
          }}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={25} color="#0a84ff" />
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>
          {app.name}
        </Text>
        <View style={styles.indicators}>
          {online !== null && (
            <Ionicons
              name={online ? 'wifi' : 'cloud-offline'}
              size={13}
              color={online ? '#30d158' : '#ff453a'}
            />
          )}
          {battery !== null && <Text style={styles.battery}>{battery}%</Text>}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {body()}
        {!!status && <Text style={styles.success}>{status}</Text>}
        {!!error && <Notice error>{error}</Notice>}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: '#1c1c1e',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    width: 50,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  indicators: {
    width: 62,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    paddingRight: 9,
  },
  battery: { color: '#8e8e93', fontSize: 9 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    paddingBottom: 34,
  },
  button: {
    minWidth: 112,
    marginTop: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  input: {
    width: '100%',
    minHeight: 43,
    marginTop: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    color: '#fff',
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#35353a',
    textAlign: 'center',
  },
  notice: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginVertical: 8,
    padding: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(100,210,255,.12)',
  },
  noticeError: { backgroundColor: 'rgba(255,69,58,.14)' },
  noticeText: { flex: 1, color: '#d1d1d6', fontSize: 10, lineHeight: 14 },
  hero: { color: '#fff', fontSize: 40, fontWeight: '300', marginTop: 5 },
  unit: { color: '#ff375f', fontSize: 11, fontWeight: '700' },
  secondary: {
    color: '#8e8e93',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  small: { color: '#8e8e93', fontSize: 10, marginTop: 3 },
  success: { color: '#30d158', fontSize: 12, marginTop: 12 },
  error: { color: '#ff453a', fontSize: 11, marginTop: 8, textAlign: 'center' },
  sectionTitle: {
    width: '100%',
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 16,
  },
  ring: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 12,
    borderColor: '#ff2d55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring2: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 11,
    borderColor: '#b7f20a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring3: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 10,
    borderColor: '#30d5c8',
  },
  metrics: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 9,
  },
  metric: { alignItems: 'center', minWidth: 65 },
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricLabel: { color: '#8e8e93', fontSize: 9, fontWeight: '700' },
  eyebrow: {
    color: '#b7f20a',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  timer: {
    color: '#fff',
    fontSize: 47,
    fontWeight: '200',
    marginVertical: 10,
    fontVariant: ['tabular-nums'],
  },
  stopwatch: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '200',
    marginBottom: 15,
    fontVariant: ['tabular-nums'],
  },
  stopwatchTabs: {
    width: '100%',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  stopwatchTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
  },
  stopwatchTabActive: { backgroundColor: '#ff9f0a' },
  stopwatchTabText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  stopwatchDial: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: '#d1d1d6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dialTop: { position: 'absolute', top: 5, color: '#fff', fontSize: 9 },
  stopwatchHand: {
    position: 'absolute',
    width: 2,
    height: 52,
    backgroundColor: '#ff453a',
    bottom: 63,
    transformOrigin: 'bottom',
  },
  dialCenter: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
  lapGraph: {
    width: '100%',
    height: 100,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  lapBar: { width: 18, borderRadius: 5, backgroundColor: '#ff9f0a' },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  city: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginVertical: 7,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  temperature: { color: '#fff', fontSize: 54, fontWeight: '200' },
  forecastScroll: { width: '100%', marginTop: 10 },
  forecastCard: {
    width: 67,
    alignItems: 'center',
    gap: 4,
    marginRight: 7,
    padding: 8,
    borderRadius: 14,
    backgroundColor: '#1c1c1e',
  },
  forecastTemperature: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  forecastDay: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomColor: '#2c2c2e',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  forecastDayName: {
    width: 70,
    color: '#ffffff',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  forecastRange: { color: '#d1d1d6', fontSize: 12 },
  album: {
    width: 108,
    height: 108,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fa2d55',
  },
  musicProgressTrack: {
    width: '92%',
    height: 5,
    marginTop: 12,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: '#3a3a3c',
  },
  musicProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#fa2d55',
  },
  musicTimeRow: {
    width: '92%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  musicMainControls: {
    width: 190,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  musicLibraryTabs: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  musicTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#1c1c1e',
  },
  musicTabActive: { backgroundColor: '#fa2d55' },
  musicTabText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  musicTrackMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  musicAction: { color: '#fff', fontSize: 13, fontWeight: '700' },
  repeatOne: {
    position: 'absolute',
    alignSelf: 'center',
    top: 7,
    color: '#fa2d55',
    fontSize: 7,
    fontWeight: '900',
  },
  disabledControl: { opacity: 0.3 },
  activeTrack: { borderWidth: 1, borderColor: 'rgba(250,45,85,.55)' },
  playerControls: {
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  card: {
    width: '100%',
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: '#1c1c1e',
  },
  cardTitle: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  calendar: { color: '#ff453a', fontSize: 65, fontWeight: '200' },
  map: { width: '100%', height: 235, borderRadius: 22 },
  workoutMap: { width: '100%', height: 125, borderRadius: 18, marginBottom: 4 },
  preview: {
    width: '100%',
    height: 225,
    borderRadius: 22,
    backgroundColor: '#1c1c1e',
  },
  cameraFrame: {
    width: '100%',
    height: 285,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#1c1c1e',
  },
  cameraControls: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  cameraTool: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  shutter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 5,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  gallery: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyLibrary: {
    width: '100%',
    minHeight: 165,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: 92, height: 92, margin: 3, borderRadius: 15 },
  photoViewer: { width: 260, height: 260, borderRadius: 18 },
  photoViewerZoomed: { width: 310, height: 360, borderRadius: 12 },
  wallet: {
    width: '100%',
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 9,
    padding: 15,
    borderRadius: 19,
    justifyContent: 'space-between',
    backgroundColor: '#3b3b98',
  },
  walletTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 0,
  },
  compass: {
    width: 142,
    height: 142,
    borderRadius: 71,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#3a3a3c',
    borderWidth: 8,
  },
  north: { position: 'absolute', top: 6, color: '#ff453a', fontWeight: '800' },
  setting: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    borderRadius: 15,
    backgroundColor: '#1c1c1e',
  },
  settingValue: { color: '#0a84ff', fontSize: 12 },
  storageCard: {
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: '#1c1c1e',
  },
  storageRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: '#35353a',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  storageTotal: { borderBottomWidth: 0 },
  storageTotalText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  storageFootnote: {
    width: '100%',
    marginTop: 8,
    color: '#8e8e93',
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
  dayRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dayButton: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c2c2e',
  },
  dayButtonActive: { backgroundColor: '#ff9f0a' },
  dayText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  lapRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomColor: '#2c2c2e',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lapTime: { color: '#ffffff', fontSize: 13, fontVariant: ['tabular-nums'] },
  recordButton: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#d1d1d6',
    backgroundColor: '#1c1c1e',
  },
  recordButtonActive: { borderColor: '#ff453a' },
  recordDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff453a',
  },
  stopSquare: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: '#ff453a',
  },
  voiceMemoCard: { flexDirection: 'column', alignItems: 'stretch' },
  voiceMemoRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memoRenameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  memoNameInput: {
    flex: 1,
    minHeight: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    color: '#ffffff',
    backgroundColor: '#2c2c2e',
  },
  memoPlaybackArea: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 9,
  },
  memoProgressTrack: {
    flex: 1,
    height: 4,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#3a3a3c',
  },
  memoProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#ff453a',
  },
  calculatorDisplay: {
    width: '100%',
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '300',
    textAlign: 'right',
    marginBottom: 10,
  },
  calculatorGrid: {
    width: 250,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calculatorKey: {
    width: 56,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333336',
  },
  calculatorZero: { width: 120 },
  calculatorOperator: { backgroundColor: '#ff9f0a' },
  calculatorKeyText: { color: '#ffffff', fontSize: 19, fontWeight: '600' },
  noteCard: {
    width: '100%',
    marginTop: 9,
    padding: 13,
    borderRadius: 15,
    backgroundColor: '#1c1c1e',
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteText: { color: '#d1d1d6', fontSize: 12, lineHeight: 17, marginTop: 8 },
});

export default WatchAppScreen;
