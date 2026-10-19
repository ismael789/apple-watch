/* @flow */
/* eslint-env jest */

import {
  FLASHLIGHT_FLASH,
  FLASHLIGHT_RED,
  FLASHLIGHT_WHITE,
  flashlightModeForSwipe,
  flashlightViewportStyle,
} from '../modes';

describe('navegación de la linterna', () => {
  it('avanza de blanco a intermitente y después a rojo', () => {
    expect(flashlightModeForSwipe(FLASHLIGHT_WHITE, -80)).toBe(
      FLASHLIGHT_FLASH,
    );
    expect(flashlightModeForSwipe(FLASHLIGHT_FLASH, -80)).toBe(FLASHLIGHT_RED);
  });

  it('retrocede con un deslizamiento hacia la derecha', () => {
    expect(flashlightModeForSwipe(FLASHLIGHT_RED, 80)).toBe(FLASHLIGHT_FLASH);
    expect(flashlightModeForSwipe(FLASHLIGHT_FLASH, 80)).toBe(FLASHLIGHT_WHITE);
  });

  it('no supera los extremos disponibles', () => {
    expect(flashlightModeForSwipe(FLASHLIGHT_WHITE, 80)).toBe(FLASHLIGHT_WHITE);
    expect(flashlightModeForSwipe(FLASHLIGHT_RED, -80)).toBe(FLASHLIGHT_RED);
  });

  it('ignora movimientos horizontales pequeños', () => {
    expect(flashlightModeForSwipe(FLASHLIGHT_FLASH, 20)).toBe(FLASHLIGHT_FLASH);
  });

  it('conserva dimensiones explícitas para no colapsar en Android Fabric', () => {
    expect(flashlightViewportStyle(320, 390)).toEqual({
      width: 320,
      height: 390,
    });
  });
});
