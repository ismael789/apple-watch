/* eslint-env jest */

import Distorter from '../Distorter';
import HexGrid from '../HexGrid';

describe('distribución de la cuadrícula de burbujas', () => {
  test('genera una posición distinta para cada aplicación', () => {
    const points = HexGrid(52).coords(31);
    expect(points).toHaveLength(31);
    expect(new Set(points.map(point => `${point.x}:${point.y}`)).size).toBe(31);
    expect(points[0].x).toBeCloseTo(0);
    expect(points[0].y).toBeCloseTo(0);
  });

  test('la burbuja central permanece visible dentro del reloj', () => {
    const distort = Distorter(360, 320, 390, 1);
    const point = distort({ x: 0, y: 0, z: 76 });
    expect(point.x).toBe(0);
    expect(point.y).toBe(0);
    expect(point.z).toBeGreaterThan(0);
  });
});
