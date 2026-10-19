/* @flow */

export const PANEL_FACE = 'face';
export const PANEL_NOTIFICATIONS = 'notifications';
export const PANEL_SMART_STACK = 'smart-stack';

export const panelOffsetFor = (panel: string, height: number) => {
  if (panel === PANEL_NOTIFICATIONS) return height;
  if (panel === PANEL_SMART_STACK) return -height;
  return 0;
};

export const resistedPanelOffset = (
  value: number,
  height: number,
  resistance: number = 0.2,
) => {
  const limit = Math.max(1, height);
  if (value > limit) return limit + (value - limit) * resistance;
  if (value < -limit) return -limit + (value + limit) * resistance;
  return value;
};

export const destinationForGesture = (
  current: string,
  dy: number,
  vy: number,
  height: number,
) => {
  const threshold = Math.max(42, height * 0.18);
  const fast = 0.55;

  if (current === PANEL_SMART_STACK) {
    return dy > threshold || vy > fast ? PANEL_FACE : PANEL_SMART_STACK;
  }
  if (current === PANEL_NOTIFICATIONS) {
    return dy < -threshold || vy < -fast ? PANEL_FACE : PANEL_NOTIFICATIONS;
  }
  if (dy < -threshold || vy < -fast) return PANEL_SMART_STACK;
  if (dy > threshold || vy > fast) return PANEL_NOTIFICATIONS;
  return PANEL_FACE;
};
