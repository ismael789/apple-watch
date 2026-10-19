import { Platform } from 'react-native';
import Constants from 'expo-constants';

let configured = false;
let nativeModule = null;

export const REMINDER_NOTIFICATIONS_AVAILABLE =
  Constants.appOwnership !== 'expo';

const notifications = () => {
  if (!REMINDER_NOTIFICATIONS_AVAILABLE) return null;
  if (!nativeModule) {
    // La futura APK incluye este módulo; Expo Go no debe intentar cargarlo.
    // eslint-disable-next-line global-require
    nativeModule = require('expo-notifications');
  }
  return nativeModule;
};

export const reminderDate = (dateText, timeText) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText || '')) return null;
  if (!/^\d{2}:\d{2}$/.test(timeText || '')) return null;
  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  )
    return null;
  return result;
};

export const configureReminderNotifications = async () => {
  const Notifications = notifications();
  if (!Notifications || configured) return false;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('watch-reminders', {
      name: 'Recordatorios del reloj',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
    });
  }
  configured = true;
  return true;
};

export const scheduleReminder = async reminder => {
  const scheduledFor = reminderDate(reminder.date, reminder.time);
  if (!scheduledFor || scheduledFor.getTime() <= Date.now()) return null;
  const Notifications = notifications();
  if (!Notifications) return null;
  await configureReminderNotifications();
  const permission = await Notifications.getPermissionsAsync();
  const finalPermission = permission.granted
    ? permission
    : await Notifications.requestPermissionsAsync();
  if (!finalPermission.granted) throw new Error('notifications-denied');
  return Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title,
      body: reminder.listName || 'Recordatorio del reloj',
      data: { reminderId: reminder.id },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledFor,
      channelId: Platform.OS === 'android' ? 'watch-reminders' : undefined,
    },
  });
};

export const cancelReminder = identifier =>
  identifier && notifications()
    ? notifications()
        .cancelScheduledNotificationAsync(identifier)
        .catch(() => {})
    : Promise.resolve();
