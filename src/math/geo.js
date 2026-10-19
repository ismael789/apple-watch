const radians = value => (value * Math.PI) / 180;
const degrees = value => (value * 180) / Math.PI;

export const distanceMeters = (from, to) => {
  const latitude = radians(to.latitude - from.latitude);
  const longitude = radians(to.longitude - from.longitude);
  const value =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitude / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export const bearingDegrees = (from, to) => {
  const start = radians(from.latitude);
  const end = radians(to.latitude);
  const longitude = radians(to.longitude - from.longitude);
  const y = Math.sin(longitude) * Math.cos(end);
  const x =
    Math.cos(start) * Math.sin(end) -
    Math.sin(start) * Math.cos(end) * Math.cos(longitude);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
};
