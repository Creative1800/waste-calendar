// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  parseSchedule,
  parseYear,
  parseDateCell,
  groupRows,
  foldAccents,
} from '../src/parse-schedule.js';

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, 'fixtures', 'sabinov-2026-q4.items.json'),
    'utf8',
  ),
);

/**
 * @param {import('../src/parse-schedule.js').Schedule} schedule
 * @param {string} routeId
 * @param {string} type
 */
function datesFor(schedule, routeId, type) {
  const route = schedule.routes.find((r) => r.id === routeId);
  assert.ok(route, `route ${routeId} missing`);
  return route.collections.filter((c) => c.type === type).map((c) => c.date);
}

test('foldAccents strips Slovak diacritics', () => {
  assert.equal(foldAccents('Október'), 'oktober');
  assert.equal(foldAccents('Jún'), 'jun');
  assert.equal(foldAccents('  TRASA 1 '), 'trasa 1');
});

test('groupRows orders rows top-down and cells left-to-right', () => {
  const rows = groupRows([
    { x: 50, y: 100, s: 'b' },
    { x: 10, y: 101, s: 'a' },
    { x: 10, y: 200, s: 'top' },
  ]);
  assert.deepEqual(
    rows.map((r) => r.items.map((i) => i.s)),
    [['top'], ['a', 'b']],
  );
});

test('parseYear reads the year from the leaflet title', () => {
  assert.equal(parseYear(fixture), 2026);
  assert.equal(parseYear([{ x: 0, y: 0, s: 'nič tu nie je' }]), null);
});

test('parseDateCell handles slash-separated dates and a missing trailing dot', () => {
  assert.deepEqual(parseDateCell('4.12. / 18.12. / 31.12', 2026).dates, [
    '2026-12-04',
    '2026-12-18',
    '2026-12-31',
  ]);
});

test('parseDateCell rejects dates that do not exist', () => {
  assert.deepEqual(parseDateCell('30.2. / 1.3.', 2026).dates, ['2026-03-01']);
});

test('the real leaflet parses without warnings', () => {
  const schedule = parseSchedule(fixture);
  assert.deepEqual(schedule.warnings, []);
  assert.equal(schedule.year, 2026);
  assert.deepEqual(
    schedule.routes.map((r) => r.id),
    ['T1', 'T2'],
  );
});

// The raw text stream emits the two street lists in reverse order, so a parser
// that trusted reading order would assign every household the wrong route.
test('street lists belong to the route they are printed under', () => {
  const schedule = parseSchedule(fixture);
  const t1 = schedule.routes.find((r) => r.id === 'T1');
  const t2 = schedule.routes.find((r) => r.id === 'T2');
  assert.ok(t1 && t2);

  assert.equal(t1.streets[0], 'Ovocinárska');
  assert.ok(t1.streets.includes('Komenského'));
  assert.ok(!t1.streets.includes('Mudroňova'));

  assert.equal(t2.streets[0], 'Mudroňova');
  assert.ok(t2.streets.includes('Levočská'));
  assert.ok(t2.streets.includes('Mat. Slovenskej'));
  assert.ok(!t2.streets.includes('Ovocinárska'));
});

// Trasa 1's December column is detached from its row in the text stream.
// These are the values read off the printed leaflet by eye.
test('Trasa 1 dates match the printed leaflet', () => {
  const s = parseSchedule(fixture);
  assert.deepEqual(datesFor(s, 'T1', 'TKO'), [
    '2026-10-12', '2026-10-26',
    '2026-11-09', '2026-11-23',
    '2026-12-07', '2026-12-21',
  ]);
  assert.deepEqual(datesFor(s, 'T1', 'PLASTY'), ['2026-10-14', '2026-11-11', '2026-12-09']);
  assert.deepEqual(datesFor(s, 'T1', 'PAPIER'), ['2026-10-19', '2026-11-25', '2026-12-21']);
  assert.deepEqual(datesFor(s, 'T1', 'SKLO'), ['2026-10-02', '2026-11-27', '2026-12-17']);
  assert.deepEqual(datesFor(s, 'T1', 'BIO'), [
    '2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29',
    '2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26',
    '2026-12-03', '2026-12-17', '2026-12-31',
  ]);
});

test('Trasa 2 dates match the printed leaflet', () => {
  const s = parseSchedule(fixture);
  assert.deepEqual(datesFor(s, 'T2', 'TKO'), [
    '2026-10-13', '2026-10-27',
    '2026-11-10', '2026-11-24',
    '2026-12-08', '2026-12-22',
  ]);
  assert.deepEqual(datesFor(s, 'T2', 'PLASTY'), ['2026-10-14', '2026-11-11', '2026-12-09']);
  assert.deepEqual(datesFor(s, 'T2', 'PAPIER'), ['2026-10-19', '2026-11-25', '2026-12-21']);
  assert.deepEqual(datesFor(s, 'T2', 'SKLO'), ['2026-10-02', '2026-11-27', '2026-12-17']);
  assert.deepEqual(datesFor(s, 'T2', 'BIO'), [
    '2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30',
    '2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27',
    '2026-12-04', '2026-12-18', '2026-12-31',
  ]);
});

// The legend at the foot of the page starts rows with "Papier", "Plasty",
// "SKLO", "BIO", "TKO" too. Only rows carrying dates are collection rows.
test('the legend at the foot of the page is not read as collection data', () => {
  const s = parseSchedule(fixture);
  const total = s.routes.reduce((n, r) => n + r.collections.length, 0);
  assert.equal(total, 54, 'expected 27 collections per route');
});

test('a document with no routes reports a warning rather than throwing', () => {
  const s = parseSchedule([{ x: 0, y: 0, s: 'KALENDÁR NA ROK 2027' }]);
  assert.equal(s.routes.length, 0);
  assert.ok(s.warnings.some((w) => w.includes('trasa')));
});
