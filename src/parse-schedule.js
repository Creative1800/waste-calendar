// @ts-check
/**
 * Parses the Sabinov waste-collection leaflet into structured collection dates.
 *
 * The PDF's raw text stream is NOT in reading order: table columns come out
 * detached from their rows, and the two route blocks' street lists are emitted
 * in reverse. Everything here therefore works from the x/y coordinates of each
 * text item and never from the order they arrive in.
 *
 * Dates in the leaflet are self-describing ("13.10."), so the month comes from
 * the date itself rather than from the column it sits under. The column header
 * is used only as a cross-check, which keeps parsing correct even if the column
 * geometry changes in a future leaflet.
 *
 * @typedef {{x: number, y: number, s: string, page?: number}} TextItem
 * @typedef {'TKO'|'PLASTY'|'PAPIER'|'SKLO'|'BIO'} WasteType
 * @typedef {{date: string, type: WasteType}} Collection
 * @typedef {{id: string, label: string, streets: string[], collections: Collection[]}} Route
 * @typedef {{year: number|null, routes: Route[], warnings: string[]}} Schedule
 */

/** Waste types as labelled on the leaflet, in the order it lists them. */
export const WASTE_TYPES = /** @type {WasteType[]} */ ([
  'TKO',
  'PLASTY',
  'PAPIER',
  'SKLO',
  'BIO',
]);

/**
 * Slovak month names, accent-folded, to month number.
 * @type {Record<string, number|undefined>}
 */
const MONTHS_SK = {
  januar: 1,
  februar: 2,
  marec: 3,
  april: 4,
  maj: 5,
  jun: 6,
  jul: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  december: 12,
};

/** Text items closer together than this vertically belong to the same row. */
const ROW_TOLERANCE = 3;

/**
 * Strips diacritics and lowercases, so "Október" matches "oktober".
 * @param {string} s
 * @returns {string}
 */
export function foldAccents(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Groups text items into visual rows by y, top of page first, each row's items
 * ordered left to right.
 * @param {TextItem[]} items
 * @param {number} [tolerance]
 * @returns {Array<{y: number, items: TextItem[]}>}
 */
export function groupRows(items, tolerance = ROW_TOLERANCE) {
  /** @type {Array<{y: number, items: TextItem[]}>} */
  const rows = [];
  for (const item of items) {
    if (!item.s || !item.s.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - item.y) <= tolerance);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  rows.sort((a, b) => b.y - a.y);
  return rows;
}

/**
 * Reads the calendar year out of the leaflet title ("... NA ROK 2026 ...").
 * @param {TextItem[]} items
 * @returns {number|null}
 */
export function parseYear(items) {
  const haystack = items.map((i) => i.s).join(' ');
  const match = /na\s+rok\s+(\d{4})/i.exec(foldAccents(haystack));
  return match ? Number(match[1]) : null;
}

/**
 * True if the text contains at least one "D.M." style date.
 * @param {string} s
 */
function hasDate(s) {
  return /\d{1,2}\s*\.\s*\d{1,2}/.test(s);
}

/**
 * Pads to two digits.
 * @param {number} n
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * True if the given Y-M-D triple is a real calendar date.
 * @param {number} year
 * @param {number} month
 * @param {number} day
 */
function isRealDate(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Extracts every date from one table cell. The leaflet separates multiple
 * dates with "/" and is inconsistent about the trailing dot ("31.12" vs
 * "31.12."), so both are accepted.
 *
 * @param {string} cell
 * @param {number} year
 * @returns {{dates: string[], months: number[]}}
 */
export function parseDateCell(cell, year) {
  /** @type {string[]} */
  const dates = [];
  /** @type {number[]} */
  const months = [];
  const re = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?/g;
  let m;
  while ((m = re.exec(cell)) !== null) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (!isRealDate(year, month, day)) continue;
    dates.push(`${year}-${pad2(month)}-${pad2(day)}`);
    months.push(month);
  }
  return { dates, months };
}

/**
 * Finds the month-column whose header sits nearest a cell horizontally.
 * @param {Array<{x: number, month: number}>|null} columns
 * @param {number} x
 * @returns {number|null}
 */
function nearestColumnMonth(columns, x) {
  if (!columns || columns.length === 0) return null;
  let best = columns[0];
  for (const col of columns) {
    if (Math.abs(col.x - x) < Math.abs(best.x - x)) best = col;
  }
  return best.month;
}

/**
 * Parses the whole leaflet.
 *
 * @param {TextItem[]} items text items with page coordinates
 * @returns {Schedule}
 */
export function parseSchedule(items) {
  const year = parseYear(items);
  /** @type {string[]} */
  const warnings = [];
  if (year === null) {
    warnings.push('Nenašiel sa rok v názve dokumentu — skontrolujte dátumy.');
  }
  const effectiveYear = year ?? new Date().getUTCFullYear();

  const rows = groupRows(items);
  /** @type {Route[]} */
  const routes = [];
  /** @type {Route|null} */
  let route = null;
  /** @type {Array<{x: number, month: number}>|null} */
  let columns = null;

  for (const row of rows) {
    // A route heading is a row containing nothing but "TRASA <n>".
    if (row.items.length === 1) {
      const heading = /^trasa\s*(\d+)$/.exec(foldAccents(row.items[0].s));
      if (heading) {
        route = {
          id: `T${heading[1]}`,
          label: `Trasa ${heading[1]}`,
          streets: [],
          collections: [],
        };
        routes.push(route);
        columns = null;
        continue;
      }
    }

    // Anything above the first route heading is the summary grid and title.
    if (!route) continue;

    // A month-header row is one where every item is a Slovak month name. It
    // establishes the column anchors for the table rows that follow.
    const monthCells = row.items
      .map((i) => ({ x: i.x, month: MONTHS_SK[foldAccents(i.s)] }))
      .filter((c) => c.month !== undefined);
    if (monthCells.length > 0 && monthCells.length === row.items.length) {
      columns = /** @type {Array<{x: number, month: number}>} */ (monthCells);
      continue;
    }

    // A data row starts with a waste-type label AND carries dates. The date
    // requirement is what keeps the legend at the foot of the page -- which
    // also starts with "Papier", "Plasty", ... -- out of the results.
    const label = foldAccents(row.items[0].s).toUpperCase();
    const type = WASTE_TYPES.find((t) => t === label);
    if (type && row.items.slice(1).some((i) => hasDate(i.s))) {
      for (const cell of row.items.slice(1)) {
        if (!hasDate(cell.s)) continue;
        const { dates, months } = parseDateCell(cell.s, effectiveYear);
        const columnMonth = nearestColumnMonth(columns, cell.x);
        for (let i = 0; i < dates.length; i++) {
          if (columnMonth !== null && months[i] !== columnMonth) {
            warnings.push(
              `${route.label} / ${type}: dátum ${dates[i]} je v stĺpci iného mesiaca — overte ho.`,
            );
          }
          route.collections.push({ date: dates[i], type });
        }
      }
      continue;
    }

    // Before the month header, the remaining prose in a route block is its
    // street list.
    if (columns === null && !hasDate(row.items[0].s)) {
      const text = row.items.map((i) => i.s).join(' ');
      for (const street of text.split(',')) {
        const trimmed = street.replace(/\.$/, '').trim();
        if (trimmed) route.streets.push(trimmed);
      }
    }
  }

  for (const r of routes) {
    r.collections = dedupeCollections(r.collections);
    if (r.collections.length === 0) {
      warnings.push(`${r.label}: nenašli sa žiadne dátumy zberu.`);
    }
  }
  if (routes.length === 0) {
    warnings.push('V dokumente sa nenašla žiadna trasa (TRASA 1 / TRASA 2).');
  }

  return { year, routes, warnings };
}

/**
 * Removes duplicate date+type pairs and sorts by date, then by leaflet order.
 * @param {Collection[]} collections
 * @returns {Collection[]}
 */
function dedupeCollections(collections) {
  const seen = new Set();
  /** @type {Collection[]} */
  const out = [];
  for (const c of collections) {
    const key = `${c.date}|${c.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      WASTE_TYPES.indexOf(a.type) - WASTE_TYPES.indexOf(b.type),
  );
  return out;
}
