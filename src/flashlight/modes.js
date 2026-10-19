/* @flow */

export const FLASHLIGHT_WHITE = 'white';
export const FLASHLIGHT_FLASH = 'flash';
export const FLASHLIGHT_RED = 'red';

export const FLASHLIGHT_MODES = [
  FLASHLIGHT_WHITE,
  FLASHLIGHT_FLASH,
  FLASHLIGHT_RED,
];

export const flashlightViewportStyle = (width: number, height: number) => ({
  width: Math.max(1, width),
  height: Math.max(1, height),
});

export const flashlightModeForSwipe = (
  currentMode: string,
  distanceX: number,
  threshold: number = 42,
) => {
  const currentIndex = Math.max(0, FLASHLIGHT_MODES.indexOf(currentMode));
  if (distanceX <= -threshold) {
    return FLASHLIGHT_MODES[
      Math.min(FLASHLIGHT_MODES.length - 1, currentIndex + 1)
    ];
  }
  if (distanceX >= threshold) {
    return FLASHLIGHT_MODES[Math.max(0, currentIndex - 1)];
  }
  return currentMode;
};
