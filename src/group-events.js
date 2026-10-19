// @ts-check
/**
 * Merges collections that fall on the same day into one calendar event, so a
 * day with glass and bio produces a single "🟢 Sklo + 🟤 Bio" notification
 * instead of two separate alarms.
 *
 * @typedef {import('./parse-schedule.js').Collection} Collection
 * @typedef {import('./parse-schedule.js').WasteType} WasteType
 * @typedef {{date: string, types: WasteType[]}} DayEvent
 */

import { WASTE_TYPES } from './parse-schedule.js';

/**
 * @param {Collection[]} collections
 * @param {{include?: WasteType[]}} [options] which waste types to keep;
 *   defaults to all of them
 * @returns {DayEvent[]} one entry per date, ascending
 */
export function groupByDate(collections, options = {}) {
  const include = options.include ?? WASTE_TYPES;
  /** @type {Map<string, Set<WasteType>>} */
  const byDate = new Map();

  for (const c of collections) {
    if (!include.includes(c.type)) continue;
    let types = byDate.get(c.date);
    if (!types) {
      types = new Set();
      byDate.set(c.date, types);
    }
    types.add(c.type);
  }

  return [...byDate.entries()]
    .map(([date, types]) => ({
      date,
      types: [...types].sort(
        (a, b) => WASTE_TYPES.indexOf(a) - WASTE_TYPES.indexOf(b),
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
