// @ts-check
// Generates an .ics from the committed fixture, without a browser.
// Useful for inspecting output and for a quick end-to-end check.
// Run: node tools/generate.mjs [T1|T2]
import fs from 'node:fs';
import path from 'node:path';
import { parseSchedule } from '../src/parse-schedule.js';
import { buildCalendar } from '../src/build-calendar.js';
import { buildIcs } from '../src/ics.js';

const routeId = (process.argv[2] ?? 'T2').toUpperCase();
const here = import.meta.dirname;
const items = JSON.parse(
  fs.readFileSync(path.join(here, '..', 'test', 'fixtures', 'sabinov-2026-q4.items.json'), 'utf8'),
);

const schedule = parseSchedule(items);
const built = buildCalendar(schedule, routeId);
const ics = buildIcs(built.events, { calendarName: built.calendarName });
const out = path.join(here, '..', `zber-odpadu-${routeId.toLowerCase()}-${schedule.year}.ics`);
fs.writeFileSync(out, ics);

console.log(`${built.calendarName}`);
console.log(`${built.events.length} events — ${built.dayCount} collection days, ${built.collectionCount} collections`);
console.log(`warnings: ${schedule.warnings.length === 0 ? 'none' : schedule.warnings.join('; ')}`);
console.log('');
const fmt = new Intl.DateTimeFormat('sk-SK', { weekday: 'short', timeZone: 'UTC' });
for (const e of built.events) {
  const wd = fmt.format(new Date(`${e.date}T00:00:00Z`));
  console.log(`  ${e.date}  ${wd.padEnd(5)} ${e.title}`);
}
console.log(`\nwrote ${path.basename(out)} (${ics.length} bytes)`);
