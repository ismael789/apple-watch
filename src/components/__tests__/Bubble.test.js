/* eslint-env jest */

import { createStyleFromPosition, isBubbleVisible } from '../Bubble';

describe('visibilidad y posición de Bubble', () => {
  test('solo muestra posiciones finitas con profundidad y opacidad positivas', () => {
    expect(isBubbleVisible({ x: 0, y: 0, z: 76 }, 1)).toBe(true);
    expect(isBubbleVisible({ x: 0, y: 0, z: 0 }, 1)).toBe(false);
    expect(isBubbleVisible({ x: 0, y: 0, z: 76 }, 0)).toBe(false);
    expect(isBubbleVisible({ x: Number.NaN, y: 0, z: 76 }, 1)).toBe(false);
  });

  test('nunca entrega transformaciones NaN a React Native', () => {
    const style = createStyleFromPosition({
      x: Number.NaN,
      y: Number.POSITIVE_INFINITY,
      z: Number.NaN,
    });
    expect(style.opacity).toBe(0);
    expect(style.transform).toEqual([
      { translateX: -100 },
      { translateY: -100 },
      { scale: 0 },
    ]);
  });
});
