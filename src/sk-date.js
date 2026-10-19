// @ts-check
/**
 * Slovak date text, in both directions.
 *
 * The leaflet, the city's website and every household member write dates as
 * `13.10.2026`. A native `<input type="date">` cannot be made to show that —
 * browsers render it in their own locale, so an English-language browser shows
 * `10/13/2026` and the page has no say in it. The check table is for comparing
 * against the printed leaflet, so the format has to be the leaflet's one on
 * every machine. That means plain text inputs, which means parsing here.
 *
 * Both functions work on calendar text only; no timezone is involved anywhere.
 */

/**
 * Formats an ISO date the Slovak way, zero-padded: "05.01.2026".
 * @param {string} isoDate
 * @returns {string}
 */
export function formatSk(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

/** `13.10.2026`, `13.10.` and `13.10`, with any spacing around the numbers. */
const SK_DATE = /^\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*(\d{4})?\s*$/;

/**
 * Parses Slovak date text into an ISO date, or null if it is not a real date.
 *
 * The year may be omitted — the leaflet writes its dates that way ("13.10.") —
 * in which case the year of the parsed schedule is used.
 *
 * @param {string} text
 * @param {{year?: number|null}} [options]
 * @returns {string|null} ISO date, or null if unparseable or not a real day
 */
export function parseSk(text, options = {}) {
  const match = SK_DATE.exec(text ?? '');
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3] ? Number(match[3]) : (options.year ?? null);
  if (year === null) return null;

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  const pad = /** @type {(n: number) => string} */ ((n) => String(n).padStart(2, '0'));
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * @param {number} year
 * @param {number} month 1-12
 * @returns {number}
 */
function daysInMonth(year, month) {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
