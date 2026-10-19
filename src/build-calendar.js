// @ts-check
/**
 * Assembles the final event list: one event per collection day for the chosen
 * route, plus the reminders to fetch the next leaflet.
 *
 * UIDs are derived from the route and the date, so re-importing a regenerated
 * file updates the existing events rather than duplicating them wherever the
 * calendar honours UIDs.
 *
 * @typedef {import('./parse-schedule.js').Schedule} Schedule
 * @typedef {import('./parse-schedule.js').WasteType} WasteType
 * @typedef {import('./ics.js').CalEvent} CalEvent
 */

import { groupByDate } from './group-events.js';
import { eventTitle, eventDescription } from './labels.js';
import { renewalEvents } from './renewal.js';

const UID_DOMAIN = 'waste-calendar.sabinov';

/**
 * @param {string} routeId
 * @param {string} isoDate
 * @param {string} [kind]
 */
function uidFor(routeId, isoDate, kind) {
  const parts = ['sabinov', routeId.toLowerCase()];
  if (kind) parts.push(kind);
  parts.push(isoDate.replace(/-/g, ''));
  return `${parts.join('-')}@${UID_DOMAIN}`;
}

/**
 * @param {Schedule} schedule
 * @param {string} routeId e.g. "T2"
 * @param {{include?: WasteType[], withRenewal?: boolean}} [options]
 * @returns {{events: CalEvent[], calendarName: string, dayCount: number, collectionCount: number}}
 */
export function buildCalendar(schedule, routeId, options = {}) {
  const route = schedule.routes.find((r) => r.id === routeId);
  if (!route) {
    throw new Error(`Trasa ${routeId} sa v dokumente nenašla.`);
  }

  const days = groupByDate(route.collections, { include: options.include });

  // The renewal reminders are anchored to the leaflet's own span, not to the
  // filtered selection: the leaflet expires on the same day whether or not you
  // happen to track every bin in it.
  const leafletDays = groupByDate(route.collections);

  /** @type {CalEvent[]} */
  const events = days.map((day) => ({
    date: day.date,
    title: eventTitle(day.types),
    description: eventDescription(day.types, route.label),
    uid: uidFor(route.id, day.date),
  }));

  const collectionCount = days.reduce((sum, d) => sum + d.types.length, 0);

  if (options.withRenewal !== false && days.length > 0 && leafletDays.length > 0) {
    const nags = renewalEvents(leafletDays[leafletDays.length - 1].date, {
      firstCollectionDate: leafletDays[0].date,
    });
    for (const nag of nags) {
      events.push({
        date: nag.date,
        title: nag.title,
        description: nag.description,
        uid: uidFor(route.id, nag.date, 'renewal'),
      });
    }
    events.sort((a, b) => a.date.localeCompare(b.date) || a.uid.localeCompare(b.uid));
  }

  return {
    events,
    calendarName: `Zber odpadu – ${route.label}`,
    dayCount: days.length,
    collectionCount,
  };
}
