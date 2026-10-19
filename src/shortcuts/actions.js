export const SHORTCUT_ACTIONS = Object.freeze([
  { id: 'music', name: 'Abrir Música', icon: 'musical-notes' },
  { id: 'workout', name: 'Abrir Entreno', icon: 'walk' },
  { id: 'stopwatch', name: 'Abrir Cronómetro', icon: 'stopwatch' },
  { id: 'timer', name: 'Abrir Temporizador', icon: 'timer' },
  { id: 'reminders', name: 'Abrir Recordatorios', icon: 'list' },
  { id: 'mindfulness', name: 'Abrir Atención plena', icon: 'flower' },
  { id: 'face', name: 'Mostrar esfera', icon: 'watch' },
]);

export const actionById = id =>
  SHORTCUT_ACTIONS.find(action => action.id === id) || null;
