/* eslint-env jest */

import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WineGlass from '../WineGlass';
import { WATCH_APPS } from '../../watchApps';

describe('WineGlass', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('monta, distribuye y permite enfocar todas las burbujas', () => {
    const onItemFocus = jest.fn();
    let tree;
    act(() => {
      tree = renderer.create(
        <WineGlass
          data={WATCH_APPS}
          renderItem={({ item }) => React.createElement(Text, null, item.name)}
          bubbleDistance={82}
          bubbleSize={76}
          sphereRadius={365}
          focusZoomScale={1.45}
          onItemFocus={onItemFocus}
        />,
      );
    });
    const wineGlass = tree.getInstance();
    expect(wineGlass.bubbles).toHaveLength(WATCH_APPS.length);

    act(() => {
      wineGlass.onLayout({
        nativeEvent: { layout: { width: 320, height: 390 } },
      });
    });
    expect(wineGlass.bubbles.every(item => item.element)).toBe(true);
    expect(wineGlass.bubbles.every(item => item.position.z > 0)).toBe(true);
    expect(wineGlass.bubbles[0].element.state.visible).toBe(true);
    expect(
      wineGlass.bubbles.filter(item => item.element.state.visible).length,
    ).toBeGreaterThan(0);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(wineGlass.bubbles[0].position.z).toBeGreaterThan(0);
    expect(wineGlass.bubbles[0].element.state.visible).toBe(true);

    act(() => {
      wineGlass.onBubblePress(0);
      jest.advanceTimersByTime(2000);
    });
    expect(onItemFocus).toHaveBeenCalledWith(WATCH_APPS[0], 0);
    act(() => {
      WATCH_APPS.slice(1).forEach((app, offset) => {
        wineGlass.onBubblePress(offset + 1);
      });
    });
    WATCH_APPS.forEach((app, index) => {
      expect(onItemFocus).toHaveBeenCalledWith(app, index);
    });
    act(() => tree.unmount());
  });

  test('espera a que todas las referencias existan si onLayout llega primero', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <WineGlass
          data={WATCH_APPS}
          renderItem={({ item }) => React.createElement(Text, null, item.name)}
        />,
      );
    });
    const wineGlass = tree.getInstance();
    const mountedBubbles = wineGlass.bubbles;
    const initialize = jest
      .spyOn(wineGlass, 'initializeAnimation')
      .mockImplementation(() => {});
    wineGlass.initialized = false;
    wineGlass.bubbles = [];

    act(() => {
      wineGlass.onLayout({
        nativeEvent: { layout: { width: 320, height: 390 } },
      });
    });
    expect(wineGlass.initialized).toBe(false);
    expect(initialize).not.toHaveBeenCalled();

    wineGlass.bubbles = mountedBubbles;
    act(() => wineGlass.tryInitialize());
    expect(wineGlass.initialized).toBe(true);
    expect(initialize).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
});
