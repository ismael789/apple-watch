const DAY = 86400000;
const RAD = Math.PI / 180;
const J1970 = 2440588;
const J2000 = 2451545;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_MONTH = 29.530588853;

const toJulian = date => date.getTime() / DAY - 0.5 + J1970;
const fromJulian = value => new Date((value + 0.5 - J1970) * DAY);
const solarMeanAnomaly = days => RAD * (357.5291 + 0.98560028 * days);
const eclipticLongitude = anomaly =>
  anomaly +
  RAD *
    (1.9148 * Math.sin(anomaly) +
      0.02 * Math.sin(2 * anomaly) +
      0.0003 * Math.sin(3 * anomaly)) +
  RAD * 102.9372 +
  Math.PI;

export const solarTimes = (date, latitude, longitude) => {
  const lw = -longitude * RAD;
  const phi = latitude * RAD;
  const julian = toJulian(date);
  const cycle = Math.round(julian - J2000 - 0.0009 - lw / (2 * Math.PI));
  const approximateNoon = 0.0009 + (lw / (2 * Math.PI) + cycle);
  const anomaly = solarMeanAnomaly(approximateNoon);
  const longitudeSun = eclipticLongitude(anomaly);
  const transit =
    J2000 +
    approximateNoon +
    0.0053 * Math.sin(anomaly) -
    0.0069 * Math.sin(2 * longitudeSun);
  const declination = Math.asin(
    Math.sin(longitudeSun) * Math.sin(23.4397 * RAD),
  );
  const altitude = -0.833 * RAD;
  const cosine =
    (Math.sin(altitude) - Math.sin(phi) * Math.sin(declination)) /
    (Math.cos(phi) * Math.cos(declination));
  if (cosine < -1) return { sunrise: null, sunset: null, polarDay: true };
  if (cosine > 1) return { sunrise: null, sunset: null, polarNight: true };
  const hourAngle = Math.acos(cosine);
  const sunset = transit + hourAngle / (2 * Math.PI);
  const sunrise = transit - hourAngle / (2 * Math.PI);
  return {
    sunrise: fromJulian(sunrise),
    sunset: fromJulian(sunset),
    dayLengthMinutes: Math.round((sunset - sunrise) * 24 * 60),
  };
};

export const moonPhase = date => {
  const age =
    ((((date.getTime() - NEW_MOON) / DAY) % SYNODIC_MONTH) + SYNODIC_MONTH) %
    SYNODIC_MONTH;
  const fraction = age / SYNODIC_MONTH;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const names = [
    'Luna nueva',
    'Creciente',
    'Cuarto creciente',
    'Gibosa creciente',
    'Luna llena',
    'Gibosa menguante',
    'Cuarto menguante',
    'Menguante',
  ];
  return {
    ageDays: age,
    fraction,
    illumination,
    name: names[Math.round(fraction * 8) % 8],
  };
};

export const nextMoonPhases = date => {
  const current = moonPhase(date).fraction;
  const phases = [
    { fraction: 0, name: 'Luna nueva' },
    { fraction: 0.25, name: 'Cuarto creciente' },
    { fraction: 0.5, name: 'Luna llena' },
    { fraction: 0.75, name: 'Cuarto menguante' },
  ];
  return phases
    .map(phase => {
      let difference = phase.fraction - current;
      if (difference <= 0) difference += 1;
      return {
        name: phase.name,
        date: new Date(date.getTime() + difference * SYNODIC_MONTH * DAY),
      };
    })
    .sort((a, b) => a.date - b.date);
};
