export const utcnow = () => new Date();

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Date -> 'YYYY-MM-DD HH:MM:SS.ffffff' (naive UTC; identical to what the previous Python app stored). */
export function toDb(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} `
    + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}000`;
}

/** Stored naive-UTC string -> ISO string without zone (the UI appends "Z"), e.g. 2026-11-07T12:30:00.000 */
export function toApi(dbValue) {
  if (!dbValue) return null;
  const d = new Date(String(dbValue).replace(' ', 'T').replace(/(\.\d{3})\d*$/, '$1') + 'Z');
  return d.toISOString().slice(0, -1);
}

export const normalizeBranch = (value) => value.trim().toUpperCase();
