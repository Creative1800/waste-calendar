// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { parseSchedule } from '../src/parse-schedule.js';
import { groupByDate } from '../src/group-events.js';
import { renewalEvents, CITY_NEWS_URL, TOOL_URL } from '../src/renewal.js';
import { buildIcs, foldLine, escapeText } from '../src/ics.js';
import { buildCalendar } from '../src/build-calendar.js';
import { eventTitle } from '../src/labels.js';

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, 'fixtures', 'sabinov-2026-q4.items.json'),
    'utf8',
  ),
);
const schedule = parseSchedule(fixture);
const FROZEN_NOW = new Date('2026-10-19T12:00:00Z');

// -- grouping ---------------------------------------------------------------

test('collections on the same day merge into one event', () => {
  const days = groupByDate([
    { date: '2026-11-27', type: 'SKLO' },
    { date: '2026-11-27', type: 'BIO' },
    { date: '2026-11-25', type: 'PAPIER' },
  ]);
  assert.deepEqual(days, [
    { date: '2026-11-25', types: ['PAPIER'] },
    { date: '2026-11-27', types: ['SKLO', 'BIO'] },
  ]);
});

test('grouping can exclude waste types', () => {
  const days = groupByDate(
    [
      { date: '2026-11-27', type: 'SKLO' },
      { date: '2026-11-27', type: 'BIO' },
    ],
    { include: ['BIO'] },
  );
  assert.deepEqual(days, [{ date: '2026-11-27', types: ['BIO'] }]);
});

test('Trasa 2 has 27 collections across 25 distinct days', () => {
  const route = schedule.routes.find((r) => r.id === 'T2');
  assert.ok(route);
  assert.equal(route.collections.length, 27);
  assert.equal(groupByDate(route.collections).length, 25);
});

// -- titles -----------------------------------------------------------------

test('event titles are Slovak and colour-coded by bin', () => {
  assert.equal(eventTitle(['SKLO', 'BIO']), 'Zber odpadu: 🟢 Sklo + 🟤 Bio');
  assert.equal(eventTitle(['TKO']), 'Zber odpadu: 🗑️ Komunálny odpad');
});

// Whatever lands on a phone comes from this calendar, so every title says so
// up front -- a notification reading only "🟤 Bio" does not explain itself.
test('every event title is prefixed with the calendar it came from', () => {
  const { events } = buildCalendar(schedule, 'T2');
  const unprefixed = events.filter((e) => !e.title.startsWith('Zber odpadu: '));
  assert.deepEqual(unprefixed, [], 'these titles lack the prefix');
});

// The renewal reminders used to be told apart by their ⚠️ prefix, which any
// change to the titles would quietly break.
test('renewal events are identified by kind, not by their title text', () => {
  const { events } = buildCalendar(schedule, 'T2');
  assert.deepEqual(
    events.filter((e) => e.kind === 'renewal').map((e) => e.date),
    ['2026-12-07', '2026-12-21'],
  );
  assert.equal(events.filter((e) => e.kind === 'collection').length, 25);
});

// -- renewal ----------------------------------------------------------------

test('renewal reminders land 24 and 10 days before the last collection', () => {
  const nags = renewalEvents('2026-12-31');
  assert.deepEqual(
    nags.map((n) => n.date),
    ['2026-12-07', '2026-12-21'],
  );
  assert.ok(nags[0].description.includes('31.12.2026'));
  assert.ok(nags[1].description.includes('posledná pripomienka'));
});

test('renewal reminders carry both links needed to act on them', () => {
  const [nag] = renewalEvents('2026-12-31');
  // The leaflet comes from the city; the .ics comes from this tool. A reminder
  // naming only one of them leaves you hunting for the other a year from now.
  assert.ok(nag.description.includes(CITY_NEWS_URL), 'missing the city news link');
  assert.ok(nag.description.includes(TOOL_URL), 'missing the tool link');
});

test('a renewal reminder is dropped if it would predate the schedule', () => {
  const nags = renewalEvents('2026-12-31', { firstCollectionDate: '2026-12-15' });
  assert.deepEqual(
    nags.map((n) => n.date),
    ['2026-12-21'],
  );
});

test('renewal reminders write the date zero-padded, as the leaflet does', () => {
  const [nag] = renewalEvents('2026-01-05', { leadDays: [1] });
  assert.ok(nag.description.includes('05.01.2026'));
});

// -- ics --------------------------------------------------------------------

test('escapeText escapes backslash before the characters it introduces', () => {
  assert.equal(escapeText('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
});

test('foldLine folds at 75 octets without splitting a character', () => {
  const line = `DESCRIPTION:${'á'.repeat(100)}`;
  const folded = foldLine(line);
  for (const physical of folded.split('\r\n')) {
    assert.ok(
      Buffer.byteLength(physical, 'utf8') <= 75,
      `line too long: ${Buffer.byteLength(physical, 'utf8')}`,
    );
  }
  // Unfolding must restore the original exactly.
  assert.equal(folded.replace(/\r\n /g, ''), line);
});

test('short lines are left alone', () => {
  assert.equal(foldLine('BEGIN:VEVENT'), 'BEGIN:VEVENT');
});

test('an all-day event ends on the following day and alarms at 18:00 before', () => {
  const ics = buildIcs(
    [
      {
        date: '2026-12-22',
        title: '🗑️ TKO',
        description: 'test',
        uid: 'u1@example',
      },
    ],
    { calendarName: 'Zber odpadu – Trasa 2', now: FROZEN_NOW },
  );
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261222'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261223'));
  assert.ok(ics.includes('TRIGGER:-PT6H'));
  assert.ok(ics.includes('DTSTAMP:20261019T120000Z'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  // Every physical line must be CRLF-terminated.
  assert.equal(ics.split('\n').length - 1, ics.split('\r\n').length - 1);
});

// -- end to end -------------------------------------------------------------

test('building Trasa 2 produces 25 collection events plus 2 renewal nags', () => {
  const { events, calendarName, dayCount, collectionCount } = buildCalendar(
    schedule,
    'T2',
  );
  assert.equal(calendarName, 'Zber odpadu – Trasa 2');
  assert.equal(dayCount, 25);
  assert.equal(collectionCount, 27);
  assert.equal(events.length, 27, '25 collection days + 2 renewal reminders');

  const renewals = events.filter((e) => e.kind === 'renewal');
  assert.deepEqual(
    renewals.map((e) => e.date),
    ['2026-12-07', '2026-12-21'],
  );
});

// The leaflet expires on the same day whether or not every bin is tracked, so
// filtering waste types must not move the renewal reminders.
test('renewal reminders are anchored to the leaflet, not to the type filter', () => {
  const all = buildCalendar(schedule, 'T2');
  const noBio = buildCalendar(schedule, 'T2', {
    include: ['TKO', 'PLASTY', 'PAPIER', 'SKLO'],
  });
  const renewalDates = (/** @type {typeof all} */ built) =>
    built.events.filter((e) => e.kind === 'renewal').map((e) => e.date);

  // Bio is what runs to 31.12; without it the last tracked collection is 22.12.
  assert.equal(noBio.events.at(-1)?.date, '2026-12-22');
  assert.deepEqual(renewalDates(noBio), renewalDates(all));
  assert.deepEqual(renewalDates(noBio), ['2026-12-07', '2026-12-21']);
});

test('UIDs are stable and unique so re-import updates rather than duplicates', () => {
  const first = buildCalendar(schedule, 'T2').events;
  const second = buildCalendar(schedule, 'T2').events;
  assert.deepEqual(
    first.map((e) => e.uid),
    second.map((e) => e.uid),
  );
  assert.equal(new Set(first.map((e) => e.uid)).size, first.length);
  assert.ok(first.some((e) => e.uid === 'sabinov-t2-20261222@waste-calendar.sabinov'));
  assert.ok(
    first.some((e) => e.uid === 'sabinov-t2-renewal-20261207@waste-calendar.sabinov'),
  );
});

test('the two routes get different UIDs and different dates', () => {
  const t1 = buildCalendar(schedule, 'T1').events;
  const t2 = buildCalendar(schedule, 'T2').events;
  assert.equal(
    t1.filter((e) => t2.some((o) => o.uid === e.uid)).length,
    0,
    'routes must not share UIDs',
  );
});

test('asking for a route the leaflet does not contain fails loudly', () => {
  assert.throws(() => buildCalendar(schedule, 'T9'), /T9/);
});

test('the generated Trasa 2 calendar is valid, complete iCalendar text', () => {
  const { events, calendarName } = buildCalendar(schedule, 'T2');
  const ics = buildIcs(events, { calendarName, now: FROZEN_NOW });
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 27);
  assert.equal((ics.match(/END:VEVENT/g) ?? []).length, 27);
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 27);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  for (const physical of ics.split('\r\n')) {
    assert.ok(Buffer.byteLength(physical, 'utf8') <= 75, `too long: ${physical}`);
  }
});

