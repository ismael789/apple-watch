/* @flow */
/* eslint-disable react/jsx-one-expression-per-line, no-nested-ternary */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';

import WineGlass from './components/WineGlass';
import WatchAppScreen from './components/WatchAppScreen';
import WatchFlashlight from './components/WatchFlashlight';
import { FLASHLIGHT_WHITE } from './flashlight/modes';
import { readStored, writeStored } from './storage';
import { useMusic } from './music/MusicProvider';
import {
  PANEL_FACE,
  PANEL_NOTIFICATIONS,
  PANEL_SMART_STACK,
  destinationForGesture,
  panelOffsetFor,
  resistedPanelOffset,
} from './navigation/panelGestures';
import {
  HOME_APPS,
  INITIAL_HOME_SCREEN,
  homeScreenAfterCrown,
} from './navigation/homeNavigation';
import { WATCH_APPS, type WatchApp } from './watchApps';

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

const FACE_STYLES = ['modular', 'minimal', 'activity'];
const FACE_COLORS = ['#0a84ff', '#ff375f', '#30d158', '#ff9f0a', '#bf5af2'];

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const WatchAppIcon = ({ app }: { app: WatchApp }) => (
  <View style={styles.appIcon}>
    <View style={styles.iconShine} />
    <Ionicons name={app.icon} size={78} color={app.color} />
  </View>
);

const Demo = () => {
  const music = useMusic();
  const { width, height } = useWindowDimensions();
  const [time, setTime] = useState(new Date());
  const [focusedApp, setFocusedApp] = useState(null);
  const [activeApp, setActiveApp] = useState(null);
  const [homeMode, setHomeMode] = useState('grid');
  const [homeScreen, setHomeScreen] = useState(INITIAL_HOME_SCREEN);
  const [dockOpen, setDockOpen] = useState(false);
  const [watchSettings, setWatchSettings] = useState(DEFAULT_SETTINGS);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [smartStackOpen, setSmartStackOpen] = useState(false);
  const [faceEditorOpen, setFaceEditorOpen] = useState(false);
  const [flashlightMode, setFlashlightMode] = useState(null);
  const [locked, setLocked] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [displayDimmed, setDisplayDimmed] = useState(false);
  const [theaterAwake, setTheaterAwake] = useState(false);
  const [sideButtonSignal, setSideButtonSignal] = useState(0);
  const [recentAppIds, setRecentAppIds] = useState([]);
  const [appOrder, setAppOrder] = useState(WATCH_APPS.map(app => app.id));
  const [editingAppOrder, setEditingAppOrder] = useState(false);
  const [glance, setGlance] = useState({
    battery: null,
    online: null,
    alarms: [],
    events: [],
    activity: [],
    weather: null,
    reminders: [],
  });
  const lastTap = useRef(0);
  const lastAlarm = useRef('');
  const appAnimation = useRef(new Animated.Value(1)).current;
  const panelOffset = useRef(new Animated.Value(0)).current;
  const panelHeight = useRef(1);
  const panelGestureStart = useRef(0);
  const smartStackAtTop = useRef(true);
  const navigationState = useRef({});
  const panelTransition = useRef(() => {});

  useEffect(() => {
    setHomeScreen(INITIAL_HOME_SCREEN);
    panelOffset.setValue(0);
    setNotificationOpen(false);
    setSmartStackOpen(false);
  }, [panelOffset]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30000);
    Promise.all([
      readStored('settings', DEFAULT_SETTINGS),
      readStored('recentApps', []),
      readStored(
        'appOrder',
        WATCH_APPS.map(app => app.id),
      ),
    ]).then(([saved, recent, savedOrder]) => {
      const next = {
        ...DEFAULT_SETTINGS,
        ...saved,
        watchFace: {
          ...DEFAULT_SETTINGS.watchFace,
          ...(saved.watchFace || {}),
        },
      };
      const validOrder = savedOrder.filter(id =>
        WATCH_APPS.some(app => app.id === id),
      );
      WATCH_APPS.forEach(app => {
        if (!validOrder.includes(app.id)) validOrder.push(app.id);
      });
      setWatchSettings(next);
      setRecentAppIds(
        recent.filter(id => WATCH_APPS.some(app => app.id === id)),
      );
      setAppOrder(validOrder);
      setLocked(Boolean(next.passcodeEnabled));
    });
    return () => clearInterval(timer);
  }, []);

  const loadGlance = async () => {
    const [
      alarms,
      events,
      activity,
      weather,
      reminders,
      battery,
      network,
    ] = await Promise.all([
      readStored('alarms', []),
      readStored('events', []),
      readStored('activity', []),
      readStored('weather', null),
      readStored('reminders', []),
      Battery.getBatteryLevelAsync().catch(() => -1),
      Network.getNetworkStateAsync().catch(() => ({})),
    ]);
    setGlance({
      alarms,
      events,
      activity,
      weather,
      reminders,
      battery: battery >= 0 ? Math.round(battery * 100) : null,
      online: network.isConnected,
    });
  };

  useEffect(() => {
    loadGlance();
    const refresh = setInterval(loadGlance, 60000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    setDisplayDimmed(false);
    if (!watchSettings.alwaysOn || homeScreen !== 'face' || activeApp)
      return undefined;
    const dimTimer = setTimeout(() => setDisplayDimmed(true), 15000);
    return () => clearTimeout(dimTimer);
  }, [watchSettings.alwaysOn, homeScreen, activeApp, time]);

  useEffect(() => {
    const checkAlarms = async () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes(),
      ).padStart(2, '0')}`;
      const today = now.toLocaleDateString('en-CA');
      const alarms = await readStored('alarms', []);
      const dueAlarm = alarms.find(alarm => {
        const scheduledKey = `${today}-${alarm.id}-${currentTime}`;
        const correctDay =
          !alarm.days ||
          alarm.days.length === 0 ||
          alarm.days.includes(now.getDay());
        const scheduled =
          correctDay &&
          alarm.time === currentTime &&
          alarm.lastFiredKey !== scheduledKey;
        const snoozed = alarm.snoozeAt && alarm.snoozeAt <= Date.now();
        return alarm.enabled !== false && (scheduled || snoozed);
      });
      const alarmKey = dueAlarm ? `${today}-${dueAlarm.id}-${currentTime}` : '';
      if (dueAlarm && lastAlarm.current !== alarmKey) {
        lastAlarm.current = alarmKey;
        const updatedAlarms = alarms.map(alarm =>
          alarm.id === dueAlarm.id
            ? { ...alarm, lastFiredKey: alarmKey, snoozeAt: null }
            : alarm,
        );
        await writeStored('alarms', updatedAlarms);
        if (dueAlarm.vibrate !== false && watchSettings.haptics) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          ).catch(() => {});
        }
        if (
          watchSettings.theaterMode ||
          ['sleep', 'do-not-disturb'].includes(watchSettings.focusMode)
        )
          return;
        Alert.alert(dueAlarm.label || 'Alarma', `Son las ${currentTime}`, [
          { text: 'Detener', style: 'cancel' },
          {
            text: 'Posponer 5 min',
            onPress: async () => {
              const current = await readStored('alarms', []);
              await writeStored(
                'alarms',
                current.map(alarm =>
                  alarm.id === dueAlarm.id
                    ? { ...alarm, snoozeAt: Date.now() + 5 * 60 * 1000 }
                    : alarm,
                ),
              );
            },
          },
        ]);
      }
    };
    checkAlarms();
    const alarmTimer = setInterval(checkAlarms, 15000);
    return () => clearInterval(alarmTimer);
  }, [
    watchSettings.focusMode,
    watchSettings.haptics,
    watchSettings.theaterMode,
  ]);

  useEffect(() => {
    if (!activeApp) return;
    appAnimation.setValue(0);
    Animated.spring(appAnimation, {
      toValue: 1,
      speed: 18,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [activeApp, appAnimation]);

  const watchWidth = Math.min(width - 34, 420);
  const watchHeight = Math.min(height - 76, watchWidth * 1.22);
  const bubbleSize = watchWidth * 0.225;
  const [navigationHeight, setNavigationHeight] = useState(watchHeight - 20);

  navigationState.current = {
    activeApp,
    dockOpen,
    faceEditorOpen,
    flashlightMode,
    homeScreen,
    locked,
    notificationOpen,
    smartStackOpen,
  };

  const currentPanel = () => {
    if (navigationState.current.smartStackOpen) return PANEL_SMART_STACK;
    if (navigationState.current.notificationOpen) return PANEL_NOTIFICATIONS;
    return PANEL_FACE;
  };

  const transitionToPanel = destination => {
    const nextHeight = Math.max(1, panelHeight.current);
    if (destination === PANEL_SMART_STACK) {
      loadGlance();
      setNotificationOpen(false);
      setSmartStackOpen(true);
    } else if (destination === PANEL_NOTIFICATIONS) {
      loadGlance();
      setSmartStackOpen(false);
      setNotificationOpen(true);
    }
    Animated.spring(panelOffset, {
      toValue: panelOffsetFor(destination, nextHeight),
      speed: 22,
      bounciness: 2,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      const showingSmartStack = destination === PANEL_SMART_STACK;
      const showingNotifications = destination === PANEL_NOTIFICATIONS;
      setSmartStackOpen(showingSmartStack);
      setNotificationOpen(showingNotifications);
      if (!showingSmartStack) smartStackAtTop.current = true;
    });
  };
  panelTransition.current = transitionToPanel;

  const resetPanels = () => {
    panelOffset.stopAnimation();
    panelOffset.setValue(0);
    setNotificationOpen(false);
    setSmartStackOpen(false);
    smartStackAtTop.current = true;
  };

  useEffect(() => {
    if (homeScreen !== 'face') resetPanels();
  }, [homeScreen]);

  const orderedApps = appOrder
    .map(id => WATCH_APPS.find(app => app.id === id))
    .filter(Boolean);
  const recentApps = recentAppIds
    .map(id => WATCH_APPS.find(app => app.id === id))
    .filter(Boolean)
    .slice(0, 3);

  const renderItem = ({ item }: { item: WatchApp }) => (
    <WatchAppIcon app={item} />
  );

  const openApp = app => {
    setFocusedApp(app);
    setDockOpen(false);
    resetPanels();
    if (app.id === 'flashlight') {
      setFlashlightMode(FLASHLIGHT_WHITE);
      return;
    }
    const nextRecent = [
      app.id,
      ...recentAppIds.filter(id => id !== app.id),
    ].slice(0, 8);
    setRecentAppIds(nextRecent);
    writeStored('recentApps', nextRecent);
    setActiveApp(app);
    if (watchSettings.haptics) Haptics.selectionAsync().catch(() => {});
  };

  const runShortcutAction = actionId => {
    if (actionId === 'face') {
      setActiveApp(null);
      setHomeScreen('face');
      resetPanels();
      return;
    }
    const target = WATCH_APPS.find(app => app.id === actionId);
    if (target) openApp(target);
  };

  const moveApp = (id, direction) => {
    const index = appOrder.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= appOrder.length) return;
    const next = [...appOrder];
    [next[index], next[target]] = [next[target], next[index]];
    setAppOrder(next);
    writeStored('appOrder', next);
  };

  const returnToApps = () => {
    setActiveApp(null);
    setHomeScreen(HOME_APPS);
    resetPanels();
  };

  const pressCrown = () => {
    if (locked) return;
    if (watchSettings.theaterMode && !theaterAwake) {
      setTheaterAwake(true);
      return;
    }
    if (watchSettings.haptics) Haptics.selectionAsync().catch(() => {});
    if (flashlightMode) setFlashlightMode(null);
    else if (activeApp) {
      returnToApps();
    } else if (
      dockOpen ||
      notificationOpen ||
      smartStackOpen ||
      faceEditorOpen
    ) {
      setDockOpen(false);
      resetPanels();
      setFaceEditorOpen(false);
    } else setHomeScreen(value => homeScreenAfterCrown(value, false));
  };

  useEffect(() => {
    if (!watchSettings.theaterMode || !theaterAwake) return undefined;
    const timeout = setTimeout(() => setTheaterAwake(false), 12000);
    return () => clearTimeout(timeout);
  }, [theaterAwake, watchSettings.theaterMode]);

  const persistWatchSettings = next => {
    setWatchSettings(next);
    writeStored('settings', next);
  };

  const nextAlarm = glance.alarms.find(item => item.enabled !== false);
  const nextEvent = [...glance.events]
    .filter(
      item =>
        !item.date || new Date(item.date).getTime() >= Date.now() - 86400000,
    )
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  const latestActivity = glance.activity[0];
  const nextReminder = [...glance.reminders]
    .filter(item => !item.completed)
    .sort((a, b) =>
      `${a.date || ''}${a.time || ''}`.localeCompare(
        `${b.date || ''}${b.time || ''}`,
      ),
    )[0];
  const notifications = [
    nextAlarm && {
      id: `alarm-${nextAlarm.id}`,
      icon: 'alarm',
      color: '#ff9f0a',
      title: nextAlarm.label || 'Alarma',
      detail: nextAlarm.time,
      category: 'alarms',
    },
    nextEvent && {
      id: `event-${nextEvent.id}`,
      icon: 'calendar',
      color: '#ff453a',
      title: nextEvent.title || 'Evento',
      detail: nextEvent.date,
      category: 'calendar',
    },
    nextReminder && {
      id: `reminder-${nextReminder.id}`,
      icon: 'list',
      color: '#ff9500',
      title: nextReminder.title,
      detail: `${nextReminder.date} ${nextReminder.time}`,
      category: 'reminders',
    },
    glance.battery !== null &&
      glance.battery <= 20 && {
        id: 'low-battery',
        icon: 'battery-dead',
        color: '#ff453a',
        title: 'Batería baja',
        detail: `${glance.battery}% en este teléfono`,
      },
  ]
    .filter(Boolean)
    .filter(item => {
      if (watchSettings.theaterMode) return false;
      if (watchSettings.focusMode === 'off') return true;
      if (watchSettings.focusMode === 'work')
        return ['calendar', 'reminders'].includes(item.category || '');
      if (watchSettings.focusMode === 'personal')
        return item.category !== 'calendar';
      return false;
    });

  const complication = id => {
    if (id === 'activity') {
      return {
        icon: 'fitness',
        label: 'Actividad',
        value: latestActivity
          ? `${latestActivity.steps} pasos`
          : 'Sin registro',
        app: 'activity',
      };
    }
    if (id === 'weather') {
      return {
        icon: 'partly-sunny',
        label: 'Tiempo',
        value:
          glance.weather && typeof glance.weather.temp === 'number'
            ? `${glance.weather.temp}°`
            : 'Sin actualizar',
        app: 'weather',
      };
    }
    if (id === 'alarm') {
      return {
        icon: 'alarm',
        label: 'Alarma',
        value: nextAlarm ? nextAlarm.time : 'Ninguna',
        app: 'alarm',
      };
    }
    if (id === 'reminders') {
      return {
        icon: 'list',
        label: 'Recordar',
        value: nextReminder ? nextReminder.title : 'Nada pendiente',
        app: 'reminders',
      };
    }
    if (id === 'now-playing') {
      return {
        icon: music.status.playing ? 'pause' : 'play',
        label: 'Reproducción',
        value: music.currentTrack
          ? music.currentTrack.name || music.currentTrack.title
          : 'Sin pista',
        app: 'now-playing',
      };
    }
    return {
      icon: 'battery-half',
      label: 'Batería',
      value: glance.battery === null ? '—' : `${glance.battery}%`,
      app: 'settings',
    };
  };

  const smartWidgets = [
    nextReminder && {
      id: 'reminders',
      icon: 'list',
      title: nextReminder.title,
      detail: `${nextReminder.date} ${nextReminder.time}`,
    },
    nextEvent && {
      id: 'event',
      icon: 'calendar',
      title: nextEvent.title,
      detail: nextEvent.date,
    },
    nextAlarm && {
      id: 'alarm',
      icon: 'alarm',
      title: nextAlarm.label || 'Alarma',
      detail: nextAlarm.time,
    },
    latestActivity && {
      id: 'activity',
      icon: 'fitness',
      title: 'Actividad',
      detail: `${latestActivity.steps} pasos`,
    },
    music.currentTrack && {
      id: 'music',
      icon: 'musical-notes',
      title: music.currentTrack.name || music.currentTrack.title,
      detail: 'Música',
    },
    {
      id: 'battery',
      icon: 'battery-half',
      title: 'Batería',
      detail: glance.battery === null ? 'No disponible' : `${glance.battery}%`,
    },
  ].filter(Boolean);

  const gestureResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          const state = navigationState.current;
          if (
            state.activeApp ||
            state.dockOpen ||
            state.faceEditorOpen ||
            state.flashlightMode ||
            state.locked ||
            state.homeScreen !== 'face'
          )
            return false;
          if (
            Math.abs(gesture.dy) < 9 ||
            Math.abs(gesture.dx) >= Math.abs(gesture.dy)
          )
            return false;
          if (state.smartStackOpen)
            return gesture.dy > 0 && smartStackAtTop.current;
          if (state.notificationOpen) return gesture.dy < 0;
          return true;
        },
        onPanResponderGrant: () => {
          panelOffset.stopAnimation(value => {
            panelGestureStart.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          panelOffset.setValue(
            resistedPanelOffset(
              panelGestureStart.current + gesture.dy,
              panelHeight.current,
            ),
          );
        },
        onPanResponderRelease: (_, gesture) => {
          const destination = destinationForGesture(
            currentPanel(),
            gesture.dy,
            gesture.vy,
            panelHeight.current,
          );
          panelTransition.current(destination);
        },
        onPanResponderTerminate: () => {
          panelTransition.current(currentPanel());
        },
      }),
    [panelOffset],
  );

  return (
    <View style={styles.stage}>
      <View
        style={[styles.watchCase, { width: watchWidth, height: watchHeight }]}
      >
        <View pointerEvents="none" style={styles.crownGuard} />
        <Pressable
          accessibilityLabel="Corona: volver o cambiar vista"
          hitSlop={12}
          onPress={pressCrown}
          style={({ pressed }) => [
            styles.digitalCrown,
            pressed && styles.physicalButtonPressed,
          ]}
        >
          <View style={styles.crownCenter} />
        </Pressable>
        <Pressable
          accessibilityLabel="Botón lateral: Centro de control"
          hitSlop={12}
          onPress={() => {
            if (watchSettings.haptics) {
              Haptics.selectionAsync().catch(() => {});
            }
            if (locked) return;
            if (activeApp && activeApp.id === 'wallet') {
              setSideButtonSignal(value => value + 1);
              return;
            }
            loadGlance();
            resetPanels();
            setDockOpen(value => !value);
          }}
          style={({ pressed }) => [
            styles.sideButton,
            pressed && styles.physicalButtonPressed,
          ]}
        />

        <View
          {...gestureResponder.panHandlers}
          style={[
            styles.watchScreen,
            {
              opacity: flashlightMode
                ? 1
                : displayDimmed && watchSettings.alwaysOn
                ? Math.min(0.28, watchSettings.brightness || 1)
                : watchSettings.brightness || 1,
            },
          ]}
        >
          {activeApp ? (
            <Animated.View
              style={[
                styles.appLayer,
                {
                  opacity: appAnimation,
                  transform: [
                    {
                      scale: appAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.88, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <WatchAppScreen
                app={activeApp}
                onClose={returnToApps}
                onSettingsChange={setWatchSettings}
                sideButtonSignal={sideButtonSignal}
                onShortcutAction={runShortcutAction}
              />
            </Animated.View>
          ) : (
            <View
              onLayout={event => {
                const measuredHeight = event.nativeEvent.layout.height;
                if (measuredHeight > 0) {
                  panelHeight.current = measuredHeight;
                  setNavigationHeight(measuredHeight);
                  panelOffset.setValue(
                    panelOffsetFor(currentPanel(), measuredHeight),
                  );
                }
              }}
              style={[
                styles.homeNavigationViewport,
                {
                  width: watchWidth - 20,
                  height: watchHeight - 20,
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.homeLayer,
                  { width: watchWidth - 20, height: watchHeight - 20 },
                  homeScreen === 'face' && {
                    transform: [{ translateY: panelOffset }],
                  },
                ]}
              >
                {homeScreen === 'face' ? (
                  <Pressable
                    onPress={() => {
                      setDisplayDimmed(false);
                      const now = Date.now();
                      if (now - lastTap.current < 350)
                        transitionToPanel(PANEL_SMART_STACK);
                      lastTap.current = now;
                    }}
                    onLongPress={() => setFaceEditorOpen(true)}
                    style={styles.watchFace}
                  >
                    <Text
                      style={[
                        styles.faceTime,
                        { color: watchSettings.watchFace.color },
                        watchSettings.watchFace.style === 'minimal' &&
                          styles.faceTimeMinimal,
                      ]}
                    >
                      {formatTime(time)}
                    </Text>
                    <Text style={styles.faceDate}>
                      {time.toLocaleDateString('es-MX', {
                        weekday: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    {watchSettings.watchFace.style === 'activity' && (
                      <View style={styles.faceActivityRing}>
                        <Ionicons name="fitness" size={25} color="#ff375f" />
                      </View>
                    )}
                    <View style={styles.complicationRow}>
                      {watchSettings.watchFace.complications.map(id => {
                        const item = complication(id);
                        const target = WATCH_APPS.find(
                          candidate => candidate.id === item.app,
                        );
                        return (
                          <Pressable
                            key={id}
                            style={styles.complication}
                            onPress={() => target && openApp(target)}
                          >
                            <Ionicons
                              name={item.icon}
                              size={16}
                              color={watchSettings.watchFace.color}
                            />
                            <Text style={styles.complicationValue}>
                              {item.value}
                            </Text>
                            <Text style={styles.complicationLabel}>
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text
                      style={[
                        styles.faceHint,
                        displayDimmed && styles.faceHintHidden,
                      ]}
                    >
                      Desliza ↑ widgets · ↓ notificaciones
                    </Text>
                  </Pressable>
                ) : homeMode === 'grid' ? (
                  <WineGlass
                    data={orderedApps}
                    renderItem={renderItem}
                    bubbleDistance={bubbleSize * 1.08}
                    bubbleSize={bubbleSize}
                    sphereRadius={bubbleSize * 4.8}
                    focusZoomScale={1.45}
                    viewportWidth={watchWidth - 20}
                    viewportHeight={watchHeight - 20}
                    onItemFocus={openApp}
                    onItemBlur={() => setFocusedApp(null)}
                  />
                ) : (
                  <ScrollView
                    contentContainerStyle={styles.appList}
                    showsVerticalScrollIndicator={false}
                  >
                    {orderedApps.map(app => (
                      <Pressable
                        key={app.id}
                        onPress={() => openApp(app)}
                        onLongPress={() => setEditingAppOrder(true)}
                        style={styles.appListRow}
                      >
                        <Ionicons name={app.icon} size={27} color={app.color} />
                        <Text style={styles.appListText}>{app.name}</Text>
                        <Ionicons
                          name={
                            editingAppOrder ? 'reorder-two' : 'chevron-forward'
                          }
                          size={17}
                          color="#636366"
                        />
                        {editingAppOrder && (
                          <>
                            <Pressable onPress={() => moveApp(app.id, -1)}>
                              <Ionicons
                                name="chevron-up"
                                size={18}
                                color="#0a84ff"
                              />
                            </Pressable>
                            <Pressable onPress={() => moveApp(app.id, 1)}>
                              <Ionicons
                                name="chevron-down"
                                size={18}
                                color="#0a84ff"
                              />
                            </Pressable>
                          </>
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                )}

                {homeScreen === 'apps' && (
                  <View pointerEvents="none" style={styles.statusBar}>
                    <View style={styles.statusDot} />
                    <Text style={styles.time}>{formatTime(time)}</Text>
                    {music.status.playing && (
                      <Ionicons name="musical-note" size={12} color="#fa2d55" />
                    )}
                    {watchSettings.theaterMode && (
                      <Ionicons name="ticket" size={12} color="#ff9f0a" />
                    )}
                    {watchSettings.focusMode !== 'off' && (
                      <Ionicons name="moon" size={12} color="#bf5af2" />
                    )}
                  </View>
                )}

                {homeScreen === 'apps' && (
                  <View pointerEvents="none" style={styles.focusLabelArea}>
                    {focusedApp ? (
                      <View style={styles.focusLabel}>
                        <Text style={styles.focusLabelText}>
                          {focusedApp.name}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </Animated.View>

              {homeScreen === 'face' && notificationOpen && (
                <Animated.View
                  pointerEvents={notificationOpen ? 'auto' : 'none'}
                  style={[
                    styles.panel,
                    {
                      width: watchWidth - 20,
                      height: watchHeight - 20,
                      top: -navigationHeight,
                      transform: [{ translateY: panelOffset }],
                    },
                  ]}
                >
                  <Text style={styles.panelTitle}>Notificaciones</Text>
                  <ScrollView
                    contentContainerStyle={styles.panelScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {notifications.length ? (
                      notifications.map(item => (
                        <View key={item.id} style={styles.panelCard}>
                          <Ionicons
                            name={item.icon}
                            size={22}
                            color={item.color}
                          />
                          <View style={styles.panelTextArea}>
                            <Text style={styles.panelCardTitle}>
                              {item.title}
                            </Text>
                            <Text style={styles.panelDetail}>
                              {item.detail}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyPanel}>
                        No hay eventos pendientes.
                      </Text>
                    )}
                  </ScrollView>
                  <Pressable
                    accessibilityLabel="Cerrar notificaciones"
                    style={styles.closePanel}
                    onPress={() => transitionToPanel(PANEL_FACE)}
                  >
                    <Text style={styles.closePanelText}>Cerrar</Text>
                  </Pressable>
                </Animated.View>
              )}

              {homeScreen === 'face' && smartStackOpen && (
                <Animated.View
                  pointerEvents={smartStackOpen ? 'auto' : 'none'}
                  style={[
                    styles.panel,
                    {
                      width: watchWidth - 20,
                      height: watchHeight - 20,
                      top: navigationHeight,
                      transform: [{ translateY: panelOffset }],
                    },
                  ]}
                >
                  <Text style={styles.panelTitle}>Pila inteligente</Text>
                  <ScrollView
                    contentContainerStyle={styles.panelScrollContent}
                    onScroll={event => {
                      smartStackAtTop.current =
                        event.nativeEvent.contentOffset.y <= 2;
                    }}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                  >
                    {smartWidgets.map(widget => (
                      <View key={widget.id} style={styles.widgetCard}>
                        <Ionicons
                          name={widget.icon}
                          size={26}
                          color={watchSettings.watchFace.color}
                        />
                        <View style={styles.panelTextArea}>
                          <Text style={styles.panelCardTitle}>
                            {widget.title || widget.id}
                          </Text>
                          <Text style={styles.panelDetail}>
                            {widget.detail}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <Pressable
                    accessibilityLabel="Cerrar pila inteligente"
                    style={styles.closePanel}
                    onPress={() => transitionToPanel(PANEL_FACE)}
                  >
                    <Text style={styles.closePanelText}>Cerrar</Text>
                  </Pressable>
                </Animated.View>
              )}
            </View>
          )}
          {watchSettings.theaterMode &&
            !theaterAwake &&
            !activeApp &&
            homeScreen === 'face' &&
            !dockOpen && (
              <Pressable
                accessibilityLabel="Despertar pantalla en Modo Cine"
                onPress={() => setTheaterAwake(true)}
                style={styles.theaterCurtain}
              >
                <Ionicons name="ticket" size={16} color="#3a3a3c" />
              </Pressable>
            )}
          {dockOpen && (
            <ScrollView
              style={styles.dock}
              contentContainerStyle={styles.dockContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.controlRow}>
                <Pressable
                  accessibilityLabel="Alternar silencio"
                  onPress={() => {
                    const next = {
                      ...watchSettings,
                      sound: !watchSettings.sound,
                    };
                    persistWatchSettings(next);
                  }}
                  style={styles.controlButton}
                >
                  <Ionicons
                    name={watchSettings.sound ? 'volume-high' : 'volume-mute'}
                    size={21}
                    color={watchSettings.sound ? '#ffffff' : '#ff453a'}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Cambiar brillo"
                  onPress={() => {
                    const current = watchSettings.brightness || 1;
                    let brightness = 1;
                    if (current > 0.85) brightness = 0.72;
                    else if (current > 0.65) brightness = 0.5;
                    const next = { ...watchSettings, brightness };
                    persistWatchSettings(next);
                  }}
                  style={styles.controlButton}
                >
                  <Ionicons name="sunny" size={21} color="#ffd60a" />
                </Pressable>
                <Pressable
                  accessibilityLabel="Alternar vibración"
                  onPress={() => {
                    const next = {
                      ...watchSettings,
                      haptics: !watchSettings.haptics,
                    };
                    persistWatchSettings(next);
                  }}
                  style={styles.controlButton}
                >
                  <Ionicons
                    name="phone-portrait"
                    size={21}
                    color={watchSettings.haptics ? '#30d158' : '#636366'}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Linterna"
                  onPress={() => {
                    setDockOpen(false);
                    setFlashlightMode(FLASHLIGHT_WHITE);
                  }}
                  style={styles.controlButton}
                >
                  <Ionicons name="flashlight" size={21} color="#ffffff" />
                </Pressable>
                <Pressable
                  accessibilityLabel="Alternar Modo Cine"
                  onPress={() => {
                    setTheaterAwake(false);
                    const next = {
                      ...watchSettings,
                      theaterMode: !watchSettings.theaterMode,
                      sound: watchSettings.theaterMode
                        ? watchSettings.sound
                        : false,
                    };
                    persistWatchSettings(next);
                  }}
                  style={styles.controlButton}
                >
                  <Ionicons
                    name="ticket"
                    size={21}
                    color={watchSettings.theaterMode ? '#ff9f0a' : '#ffffff'}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Cambiar modo de Concentración"
                  onPress={() => {
                    const modes = [
                      'off',
                      'do-not-disturb',
                      'personal',
                      'work',
                      'sleep',
                    ];
                    const current = modes.indexOf(watchSettings.focusMode);
                    persistWatchSettings({
                      ...watchSettings,
                      focusMode: modes[(current + 1) % modes.length],
                    });
                  }}
                  style={styles.controlButton}
                >
                  <Ionicons
                    name="moon"
                    size={21}
                    color={
                      watchSettings.focusMode === 'off' ? '#ffffff' : '#bf5af2'
                    }
                  />
                </Pressable>
                {watchSettings.passcodeEnabled && (
                  <Pressable
                    accessibilityLabel="Bloquear reloj"
                    onPress={() => {
                      setDockOpen(false);
                      setUnlockCode('');
                      setLocked(true);
                    }}
                    style={styles.controlButton}
                  >
                    <Ionicons name="lock-closed" size={21} color="#ffffff" />
                  </Pressable>
                )}
              </View>
              <View style={styles.controlStatus}>
                <Ionicons
                  name={glance.online ? 'wifi' : 'cloud-offline'}
                  size={13}
                  color="#ffffff"
                />
                <Text style={styles.controlStatusText}>
                  {glance.battery === null
                    ? 'Batería —'
                    : `Batería ${glance.battery}%`}
                </Text>
              </View>
              <Text style={styles.dockTitle}>Centro de control</Text>
              <Text style={styles.dockSubtitle}>
                {watchSettings.theaterMode ? 'Modo Cine · ' : ''}
                Concentración: {watchSettings.focusMode}
              </Text>
              <Text style={styles.dockSubtitle}>Apps recientes</Text>
              {(recentApps.length ? recentApps : orderedApps.slice(0, 3)).map(
                app => (
                  <Pressable
                    key={app.id}
                    style={styles.dockRow}
                    onPress={() => openApp(app)}
                  >
                    <Ionicons name={app.icon} size={25} color={app.color} />
                    <Text style={styles.dockText}>{app.name}</Text>
                  </Pressable>
                ),
              )}
              <Pressable
                style={styles.modeButton}
                onPress={() => {
                  setHomeMode(value => (value === 'grid' ? 'list' : 'grid'));
                  setDockOpen(false);
                }}
              >
                <Ionicons
                  name={homeMode === 'grid' ? 'list' : 'apps'}
                  size={20}
                  color="#0a84ff"
                />
                <Text style={styles.modeText}>Cambiar vista</Text>
              </Pressable>
              <Pressable
                style={styles.modeButton}
                onPress={() => {
                  setEditingAppOrder(value => !value);
                  setHomeMode('list');
                  setHomeScreen(HOME_APPS);
                  setDockOpen(false);
                }}
              >
                <Ionicons name="reorder-three" size={20} color="#0a84ff" />
                <Text style={styles.modeText}>Organizar aplicaciones</Text>
              </Pressable>
              <Pressable
                style={styles.modeButton}
                onPress={() => {
                  const original = WATCH_APPS.map(app => app.id);
                  setAppOrder(original);
                  writeStored('appOrder', original);
                }}
              >
                <Ionicons name="refresh" size={20} color="#0a84ff" />
                <Text style={styles.modeText}>Restablecer orden</Text>
              </Pressable>
            </ScrollView>
          )}
          {faceEditorOpen && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Personalizar esfera</Text>
              <Text style={styles.editorLabel}>ESTILO</Text>
              <View style={styles.editorRow}>
                {FACE_STYLES.map(style => (
                  <Pressable
                    key={style}
                    onPress={() =>
                      persistWatchSettings({
                        ...watchSettings,
                        watchFace: { ...watchSettings.watchFace, style },
                      })
                    }
                    style={[
                      styles.editorChoice,
                      watchSettings.watchFace.style === style &&
                        styles.editorChoiceActive,
                    ]}
                  >
                    <Text style={styles.editorChoiceText}>{style}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.editorLabel}>COLOR</Text>
              <View style={styles.editorRow}>
                {FACE_COLORS.map(color => (
                  <Pressable
                    key={color}
                    accessibilityLabel={`Color ${color}`}
                    onPress={() =>
                      persistWatchSettings({
                        ...watchSettings,
                        watchFace: { ...watchSettings.watchFace, color },
                      })
                    }
                    style={[
                      styles.colorChoice,
                      { backgroundColor: color },
                      watchSettings.watchFace.color === color &&
                        styles.colorChoiceActive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.editorLabel}>COMPLICACIÓN CENTRAL</Text>
              <View style={styles.editorRow}>
                {[
                  'activity',
                  'weather',
                  'alarm',
                  'battery',
                  'reminders',
                  'now-playing',
                ].map(id => (
                  <Pressable
                    key={id}
                    onPress={() =>
                      persistWatchSettings({
                        ...watchSettings,
                        watchFace: {
                          ...watchSettings.watchFace,
                          complications: [
                            watchSettings.watchFace.complications[0],
                            id,
                            watchSettings.watchFace.complications[2],
                          ],
                        },
                      })
                    }
                    style={styles.editorChoice}
                  >
                    <Ionicons
                      name={complication(id).icon}
                      size={19}
                      color="#ffffff"
                    />
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={styles.closePanel}
                onPress={() => setFaceEditorOpen(false)}
              >
                <Text style={styles.closePanelText}>Listo</Text>
              </Pressable>
            </View>
          )}
          {flashlightMode && (
            <WatchFlashlight
              height={watchHeight - 20}
              mode={flashlightMode}
              onClose={() => setFlashlightMode(null)}
              onModeChange={setFlashlightMode}
              width={watchWidth - 20}
            />
          )}
          {locked && (
            <View style={styles.lockScreen}>
              <Ionicons name="lock-closed" size={34} color="#ffffff" />
              <Text style={styles.lockTitle}>Introduce el código</Text>
              <View style={styles.codeDots}>
                {[0, 1, 2, 3].map(index => (
                  <View
                    key={index}
                    style={[
                      styles.codeDot,
                      unlockCode.length > index && styles.codeDotFilled,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.keypad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(number => (
                  <Pressable
                    key={number}
                    style={styles.keypadKey}
                    onPress={() => {
                      const next = `${unlockCode}${number}`.slice(0, 4);
                      if (next.length === 4) {
                        if (next === watchSettings.passcode) {
                          setLocked(false);
                          setUnlockCode('');
                        } else {
                          setUnlockCode('');
                          Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Error,
                          ).catch(() => {});
                        }
                      } else setUnlockCode(next);
                    }}
                  >
                    <Text style={styles.keypadText}>{number}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.instruction}>
        {activeApp
          ? 'Pulsa la corona para volver a las apps'
          : homeScreen === 'face'
          ? 'Pulsa la corona para ver las burbujas'
          : 'Arrastra para explorar · Toca para abrir'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 17,
  },
  watchCase: {
    padding: 8,
    borderRadius: 62,
    backgroundColor: '#303034',
    borderColor: '#5a5a60',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 20,
  },
  watchScreen: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 53,
    backgroundColor: '#000000',
    borderColor: '#111114',
    borderWidth: 2,
  },
  theaterCurtain: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeNavigationViewport: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  homeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  appLayer: { flex: 1 },
  appIcon: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
  },
  iconShine: {
    position: 'absolute',
    top: 13,
    left: 30,
    width: 90,
    height: 30,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{ rotate: '-18deg' }],
  },
  appSymbol: {
    width: 148,
    textAlign: 'center',
    fontSize: 62,
    fontWeight: '700',
    letterSpacing: -4,
    textShadowColor: 'rgba(0,0,0,0.24)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  statusBar: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 5,
    height: 5,
    marginRight: 6,
    borderRadius: 3,
    backgroundColor: '#ff453a',
  },
  time: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  focusLabelArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    alignItems: 'center',
  },
  focusLabel: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(36,36,40,0.9)',
  },
  focusLabelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  crownGuard: {
    position: 'absolute',
    right: -8,
    top: '23%',
    width: 10,
    height: 82,
    borderRadius: 5,
    backgroundColor: '#1d1d20',
  },
  digitalCrown: {
    position: 'absolute',
    right: -20,
    top: '27%',
    zIndex: 5,
    width: 29,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#55555b',
    borderColor: '#7b7b82',
    borderWidth: 2,
  },
  crownCenter: {
    width: 4,
    height: 38,
    borderRadius: 2,
    backgroundColor: '#ff375f',
  },
  sideButton: {
    position: 'absolute',
    right: -13,
    top: '47%',
    width: 11,
    height: 48,
    borderRadius: 5,
    backgroundColor: '#4a4a50',
  },
  physicalButtonPressed: { opacity: 0.55, transform: [{ scale: 0.94 }] },
  appList: { paddingTop: 38, paddingHorizontal: 16, paddingBottom: 25 },
  appListRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomColor: '#1c1c1e',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appListText: { flex: 1, color: '#ffffff', fontSize: 15, fontWeight: '600' },
  dock: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.96)',
  },
  dockContent: {
    paddingTop: 38,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  dockTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  dockSubtitle: { color: '#8e8e93', fontSize: 10, fontWeight: '800' },
  controlStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  controlStatusText: { color: '#d1d1d6', fontSize: 10 },
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  controlButton: {
    width: 62,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c2c2e',
  },
  dockRow: { height: 45, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dockText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  modeButton: {
    marginTop: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 17,
    backgroundColor: '#1c1c1e',
  },
  modeText: { color: '#0a84ff', fontSize: 12, fontWeight: '700' },
  instruction: {
    marginTop: 18,
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  watchFace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 14,
  },
  faceTime: { fontSize: 66, fontWeight: '300', letterSpacing: -3 },
  faceTimeMinimal: { color: '#ffffff', fontSize: 76, fontWeight: '200' },
  faceDate: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  faceActivityRing: {
    width: 48,
    height: 48,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 5,
    borderColor: '#30d158',
  },
  complicationRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 7,
    marginTop: 18,
  },
  complication: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
    borderRadius: 14,
    backgroundColor: '#1c1c1e',
  },
  complicationValue: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  complicationLabel: { color: '#8e8e93', fontSize: 8, marginTop: 2 },
  faceHint: {
    minHeight: 13,
    marginTop: 12,
    color: '#636366',
    fontSize: 9,
  },
  faceHintHidden: { opacity: 0 },
  panel: {
    position: 'absolute',
    left: 0,
    zIndex: 31,
    paddingTop: 25,
    paddingHorizontal: 17,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.98)',
  },
  panelScrollContent: { flexGrow: 1, paddingBottom: 8 },
  panelTitle: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 12,
  },
  panelCard: {
    width: '100%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
    marginBottom: 8,
    borderRadius: 17,
    backgroundColor: '#1c1c1e',
  },
  widgetCard: {
    width: '100%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    marginBottom: 9,
    borderRadius: 22,
    backgroundColor: '#1c1c1e',
  },
  panelTextArea: { flex: 1 },
  panelCardTitle: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  panelDetail: { color: '#8e8e93', fontSize: 10, marginTop: 3 },
  emptyPanel: { color: '#8e8e93', textAlign: 'center', marginTop: 80 },
  closePanel: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  closePanelText: { color: '#0a84ff', fontSize: 13, fontWeight: '700' },
  editorLabel: {
    color: '#8e8e93',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 7,
  },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  editorChoice: {
    minWidth: 42,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 14,
    backgroundColor: '#2c2c2e',
  },
  editorChoiceActive: { borderWidth: 2, borderColor: '#ffffff' },
  editorChoiceText: {
    color: '#ffffff',
    fontSize: 9,
    textTransform: 'capitalize',
  },
  colorChoice: { width: 35, height: 35, borderRadius: 18 },
  colorChoiceActive: { borderWidth: 3, borderColor: '#ffffff' },
  lockScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#000000',
  },
  lockTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 9,
  },
  codeDots: { flexDirection: 'row', gap: 9, marginVertical: 14 },
  codeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  codeDotFilled: { backgroundColor: '#ffffff' },
  keypad: {
    width: 205,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 9,
  },
  keypadKey: {
    width: 54,
    height: 42,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c2c2e',
  },
  keypadText: { color: '#ffffff', fontSize: 19, fontWeight: '600' },
});

export default Demo;
