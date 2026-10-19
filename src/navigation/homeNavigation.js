/* @flow */

export const HOME_APPS = 'apps';
export const HOME_FACE = 'face';
export const INITIAL_HOME_SCREEN = HOME_APPS;

export const toggleHomeScreen = (screen: string) =>
  screen === HOME_FACE ? HOME_APPS : HOME_FACE;

export const homeScreenAfterCrown = (screen: string, hasActiveApp: boolean) =>
  hasActiveApp ? HOME_APPS : toggleHomeScreen(screen);
