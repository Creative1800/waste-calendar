// @ts-check
/**
 * The leaflet only covers part of a year, so the generated calendar runs out.
 * Rather than depend on a server or a cron job to remind anyone, the calendar
 * reminds you about itself: these events are derived from the last collection
 * date in the parsed data, so they can never drift out of step with it.
 */

import { formatSk } from './sk-date.js';

/** Where the city publishes each new leaflet. */
export const CITY_NEWS_URL = 'https://www.sabinov.sk/navstevnik/aktuality';

/** Days before the final collection on which to nag. */
const DEFAULT_LEAD_DAYS = [24, 10];

/**
 * @param {string} isoDate
 * @param {number} days
 * @returns {string}
 */
function minusDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds the "fetch the next leaflet" reminders.
 *
 * @param {string} lastCollectionDate ISO date of the final collection
 * @param {{leadDays?: number[], firstCollectionDate?: string}} [options]
 * @returns {Array<{date: string, title: string, description: string}>}
 */
export function renewalEvents(lastCollectionDate, options = {}) {
  const leadDays = options.leadDays ?? DEFAULT_LEAD_DAYS;
  const floor = options.firstCollectionDate;

  const dates = leadDays
    .map((days) => minusDays(lastCollectionDate, days))
    // A very short leaflet could push a reminder before the schedule even
    // starts, which would be useless noise.
    .filter((date) => !floor || date >= floor)
    .sort();

  return [...new Set(dates)].map((date, index, all) => ({
    date,
    title: '⚠️ Kalendár zberu odpadu sa končí',
    description: [
      `Posledný zber podľa súčasného kalendára je ${formatSk(lastCollectionDate)}.`,
      '',
      'Stiahnite nový kalendár zberu z webu mesta a vygenerujte nový .ics súbor:',
      CITY_NEWS_URL,
      '',
      index === all.length - 1
        ? 'Toto je posledná pripomienka.'
        : 'Ďalšia pripomienka príde neskôr.',
    ].join('\n'),
  }));
}
