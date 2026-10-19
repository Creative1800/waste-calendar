// @ts-check
/**
 * Slovak labels for calendar events. These are what the household reads on
 * their phones, so they match the wording and the bin colours on the leaflet.
 *
 * @typedef {import('./parse-schedule.js').WasteType} WasteType
 */

/** @type {Record<WasteType, {name: string, emoji: string, note: string}>} */
export const WASTE_LABELS = {
  TKO: {
    name: 'TKO',
    emoji: '🗑️',
    note: 'Zmesový komunálny odpad',
  },
  PLASTY: {
    name: 'Plasty',
    emoji: '🟡',
    note: 'Odpady z obalov z plastov a z určených neobalových výrobkov z plastov',
  },
  PAPIER: {
    name: 'Papier',
    emoji: '🔵',
    note: 'Odpady z obalov z papiera a lepenky a z určených neobalových výrobkov z papiera a lepenky',
  },
  SKLO: {
    name: 'Sklo',
    emoji: '🟢',
    note: 'Odpady z obalov zo skla a z určených neobalových výrobkov zo skla',
  },
  BIO: {
    name: 'Bio',
    emoji: '🟤',
    note: 'Biologicky rozložiteľný komunálny odpad',
  },
};

/**
 * Month names as the leaflet prints them, indexed 1-12 so a month number can
 * be looked up directly. `Intl` would give these in the wrong case ("október")
 * for a column heading.
 * @type {Record<number, string>}
 */
export const MONTH_NAMES_SK = {
  1: 'Január',
  2: 'Február',
  3: 'Marec',
  4: 'Apríl',
  5: 'Máj',
  6: 'Jún',
  7: 'Júl',
  8: 'August',
  9: 'September',
  10: 'Október',
  11: 'November',
  12: 'December',
};

/**
 * Builds the event title, e.g. "🟢 Sklo + 🟤 Bio".
 * @param {WasteType[]} types
 * @returns {string}
 */
export function eventTitle(types) {
  return types
    .map((t) => `${WASTE_LABELS[t].emoji} ${WASTE_LABELS[t].name}`)
    .join(' + ');
}

/**
 * Builds the event description: what each bin is for, plus the standing
 * instruction to put the bins out the evening before.
 * @param {WasteType[]} types
 * @param {string} routeLabel
 * @returns {string}
 */
export function eventDescription(types, routeLabel) {
  const lines = types.map((t) => `${WASTE_LABELS[t].name}: ${WASTE_LABELS[t].note}`);
  lines.push('');
  lines.push('Nádoby vyložte večer pred dňom zberu.');
  lines.push(`${routeLabel} — Mesto Sabinov.`);
  return lines.join('\n');
}
