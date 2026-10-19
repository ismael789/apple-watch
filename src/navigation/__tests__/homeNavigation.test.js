/* eslint-env jest */

import {
  HOME_APPS,
  HOME_FACE,
  INITIAL_HOME_SCREEN,
  homeScreenAfterCrown,
  toggleHomeScreen,
} from '../homeNavigation';

describe('navegación principal del reloj', () => {
  test('inicia siempre en la cuadrícula de aplicaciones', () => {
    expect(INITIAL_HOME_SCREEN).toBe(HOME_APPS);
  });

  test('la corona alterna entre burbujas y carátula', () => {
    expect(toggleHomeScreen(HOME_APPS)).toBe(HOME_FACE);
    expect(toggleHomeScreen(HOME_FACE)).toBe(HOME_APPS);
  });

  test('aplicación → burbujas → hora → burbujas', () => {
    let screen = HOME_FACE;
    screen = homeScreenAfterCrown(screen, true);
    expect(screen).toBe(HOME_APPS);
    screen = homeScreenAfterCrown(screen, false);
    expect(screen).toBe(HOME_FACE);
    screen = homeScreenAfterCrown(screen, false);
    expect(screen).toBe(HOME_APPS);
  });
});
