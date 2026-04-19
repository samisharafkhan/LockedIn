export function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** ISO dates for the last `n` calendar days ending at `end` (inclusive). */
export function lastNDayKeys(n: number, end = new Date()) {
  const keys: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = new Date(end);
    t.setDate(t.getDate() - i);
    keys.push(isoDate(t));
  }
  return keys;
}

export function weekdayShort(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
}
