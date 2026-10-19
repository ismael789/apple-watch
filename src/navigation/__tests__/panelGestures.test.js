/* eslint-env jest */

import {
  PANEL_FACE,
  PANEL_NOTIFICATIONS,
  PANEL_SMART_STACK,
  destinationForGesture,
  panelOffsetFor,
  resistedPanelOffset,
} from '../panelGestures';

describe('panel gestures', () => {
  test('maps each panel to one full viewport', () => {
    expect(panelOffsetFor(PANEL_FACE, 300)).toBe(0);
    expect(panelOffsetFor(PANEL_NOTIFICATIONS, 300)).toBe(300);
    expect(panelOffsetFor(PANEL_SMART_STACK, 300)).toBe(-300);
  });

  test('opens panels only after distance or velocity threshold', () => {
    expect(destinationForGesture(PANEL_FACE, -80, 0, 300)).toBe(
      PANEL_SMART_STACK,
    );
    expect(destinationForGesture(PANEL_FACE, 80, 0, 300)).toBe(
      PANEL_NOTIFICATIONS,
    );
    expect(destinationForGesture(PANEL_FACE, 10, 0, 300)).toBe(PANEL_FACE);
    expect(destinationForGesture(PANEL_FACE, -10, -0.8, 300)).toBe(
      PANEL_SMART_STACK,
    );
  });

  test('reverse gestures close their corresponding panel', () => {
    expect(destinationForGesture(PANEL_SMART_STACK, 70, 0, 300)).toBe(
      PANEL_FACE,
    );
    expect(destinationForGesture(PANEL_NOTIFICATIONS, -70, 0, 300)).toBe(
      PANEL_FACE,
    );
  });

  test('resistance keeps overscroll close to the viewport', () => {
    expect(resistedPanelOffset(400, 300)).toBe(320);
    expect(resistedPanelOffset(-400, 300)).toBe(-320);
    expect(resistedPanelOffset(120, 300)).toBe(120);
  });
});
