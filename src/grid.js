// @ts-check
/**
 * Rearranges collections into the shape the printed leaflet uses: one row per
 * waste type, one column per month, day numbers in the cells.
 *
 * This exists so the leaflet and the screen can be read side by side. A list of
 * twenty-five dates is hard to check against a grid; a grid against a grid
 * takes seconds. It is built from the dates currently on screen, edits
 * included, so it always shows what would actually be exported.
 *
 * Every waste type gets a row whether or not the household tracks it, because
 * the point is to match the leaflet, not the subset. Which rows to grey out is
 * the renderer's business, so no filtering happens here.
 *
 * @typedef {import('./parse-schedule.js').Collection} Collection
 * @typedef {import('./parse-schedule.js').WasteType} WasteType
 * @typedef {{year: number, month: number}} GridMonth
 * @typedef {{type: WasteType, cells: number[][]}} GridRow
 * @typedef {{months: GridMonth[], rows: GridRow[]}} Grid
 */

import { WASTE_TYPES } from './parse-schedule.js';

/**
 * @param {Collection[]} collections
 * @returns {Grid} columns ascending by month, one row per waste type in the
 *   order the leaflet lists them; `cells[i]` holds the day numbers for
 *   `months[i]`, ascending and deduplicated
 */
export function buildGrid(collections) {
  /** @type {Map<string, Map<WasteType, Set<number>>>} */
  const byMonth = new Map();

  for (const c of collections) {
    const key = c.date.slice(0, 7);
    const day = Number(c.date.slice(8, 10));
    let types = byMonth.get(key);
    if (!types) {
      types = new Map();
      byMonth.set(key, types);
    }
    let days = types.get(c.type);
    if (!days) {
      days = new Set();
      types.set(c.type, days);
    }
    days.add(day);
  }

  const keys = [...byMonth.keys()].sort();
  const months = keys.map((key) => {
    const [year, month] = key.split('-').map(Number);
    return { year, month };
  });

  const rows = WASTE_TYPES.map((type) => ({
    type,
    cells: keys.map((key) =>
      [...(byMonth.get(key)?.get(type) ?? [])].sort((a, b) => a - b),
    ),
  }));

  return { months, rows };
}
