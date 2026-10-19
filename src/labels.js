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
