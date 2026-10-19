export const WORLD_CITIES = [
  { name: 'Ciudad de México', timeZone: 'America/Mexico_City' },
  { name: 'Hermosillo', timeZone: 'America/Hermosillo' },
  { name: 'Nueva York', timeZone: 'America/New_York' },
  { name: 'Los Ángeles', timeZone: 'America/Los_Angeles' },
  { name: 'Londres', timeZone: 'Europe/London' },
  { name: 'Madrid', timeZone: 'Europe/Madrid' },
  { name: 'París', timeZone: 'Europe/Paris' },
  { name: 'Tokio', timeZone: 'Asia/Tokyo' },
  { name: 'Seúl', timeZone: 'Asia/Seoul' },
  { name: 'Sídney', timeZone: 'Australia/Sydney' },
  { name: 'Dubái', timeZone: 'Asia/Dubai' },
  { name: 'São Paulo', timeZone: 'America/Sao_Paulo' },
];

export const cityDateParts = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('es-MX', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const read = type => {
    const part = parts.find(item => item.type === type);
    return part ? part.value : '';
  };
  const hour = Number(read('hour'));
  return {
    time: `${read('hour')}:${read('minute')}`,
    date: `${read('weekday')} ${read('day')} ${read('month')}`,
    isDay: hour >= 7 && hour < 19,
  };
};

export const timeZoneOffsetMinutes = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = type => Number(parts.find(item => item.type === type).value);
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
};
