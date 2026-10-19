/* global describe, expect, test */

import { moonPhase, nextMoonPhases, solarTimes } from '../astronomy';
import { bearingDegrees, distanceMeters } from '../geo';
import { cityDateParts, timeZoneOffsetMinutes } from '../../time/worldClock';

describe('cálculos reales del reloj', () => {
  test('usa zonas IANA y respeta diferencias conocidas', () => {
    const date = new Date('2026-01-15T12:00:00Z');
    expect(cityDateParts(date, 'Asia/Tokyo').time).toBe('21:00');
    expect(timeZoneOffsetMinutes(date, 'America/Hermosillo')).toBe(-420);
  });

  test('calcula distancia y rumbo geográficos', () => {
    const from = { latitude: 0, longitude: 0 };
    const east = { latitude: 0, longitude: 1 };
    expect(distanceMeters(from, east)).toBeGreaterThan(111000);
    expect(distanceMeters(from, east)).toBeLessThan(112000);
    expect(bearingDegrees(from, east)).toBeCloseTo(90, 5);
  });

  test('calcula eventos solares plausibles y fase lunar', () => {
    const times = solarTimes(new Date('2026-03-20T12:00:00Z'), 0, 0);
    expect(times.sunrise).toBeInstanceOf(Date);
    expect(times.sunset).toBeInstanceOf(Date);
    expect(times.dayLengthMinutes).toBeGreaterThan(700);
    expect(times.dayLengthMinutes).toBeLessThan(750);
    const phase = moonPhase(new Date('2000-01-06T18:14:00Z'));
    expect(phase.illumination).toBeCloseTo(0, 5);
    expect(phase.name).toBe('Luna nueva');
    const next = nextMoonPhases(new Date('2000-01-06T18:14:00Z'));
    expect(next).toHaveLength(4);
    expect(next[0].date.getTime()).toBeGreaterThan(
      new Date('2000-01-06T18:14:00Z').getTime(),
    );
  });
});
