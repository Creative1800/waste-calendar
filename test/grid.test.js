// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildGrid } from '../src/grid.js';
import { MONTH_NAMES_SK } from '../src/labels.js';
import { parseSchedule, WASTE_TYPES } from '../src/parse-schedule.js';

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, 'fixtures', 'sabinov-2026-q4.items.json'),
    'utf8',
  ),
);

test('the grid is laid out like the leaflet: a column per month, a row per type', () => {
  const grid = buildGrid([
    { date: '2026-10-13', type: 'TKO' },
    { date: '2026-10-27', type: 'TKO' },
    { date: '2026-11-10', type: 'TKO' },
    { date: '2026-10-14', type: 'PLASTY' },
  ]);

  assert.deepEqual(grid.months, [
    { year: 2026, month: 10 },
    { year: 2026, month: 11 },
  ]);
  const tko = grid.rows.find((r) => r.type === 'TKO');
  assert.deepEqual(tko?.cells, [[13, 27], [10]]);
});

test('every waste type gets a row, in leaflet order, even with no dates', () => {
  const grid = buildGrid([{ date: '2026-10-13', type: 'TKO' }]);

  assert.deepEqual(
    grid.rows.map((r) => r.type),
    WASTE_TYPES,
  );
  assert.deepEqual(grid.rows.find((r) => r.type === 'SKLO')?.cells, [[]]);
});

test('days are sorted and duplicates collapse', () => {
  const grid = buildGrid([
    { date: '2026-10-27', type: 'BIO' },
    { date: '2026-10-02', type: 'BIO' },
    { date: '2026-10-27', type: 'BIO' },
  ]);

  assert.deepEqual(grid.rows.find((r) => r.type === 'BIO')?.cells, [[2, 27]]);
});

test('months stay in calendar order across a year boundary', () => {
  const grid = buildGrid([
    { date: '2027-01-05', type: 'TKO' },
    { date: '2026-12-08', type: 'TKO' },
  ]);

  assert.deepEqual(grid.months, [
    { year: 2026, month: 12 },
    { year: 2027, month: 1 },
  ]);
});

test('an empty schedule produces no columns and empty rows', () => {
  const grid = buildGrid([]);

  assert.deepEqual(grid.months, []);
  assert.equal(grid.rows.length, WASTE_TYPES.length);
  assert.deepEqual(grid.rows[0].cells, []);
});

test('month names cover all twelve months in Slovak', () => {
  assert.equal(MONTH_NAMES_SK[10], 'Október');
  assert.equal(MONTH_NAMES_SK[1], 'Január');
  assert.equal(MONTH_NAMES_SK[12], 'December');
});

// -- against the real leaflet ----------------------------------------------

test('the grid of the real leaflet matches the printed table for Trasa 2', () => {
  const schedule = parseSchedule(fixture);
  const route = schedule.routes.find((r) => r.id === 'T2');
  assert.ok(route, 'Trasa 2 missing from the fixture');

  const grid = buildGrid(route.collections);

  assert.deepEqual(grid.months, [
    { year: 2026, month: 10 },
    { year: 2026, month: 11 },
    { year: 2026, month: 12 },
  ]);
  assert.deepEqual(
    Object.fromEntries(grid.rows.map((r) => [r.type, r.cells])),
    {
      TKO: [[13, 27], [10, 24], [8, 22]],
      PLASTY: [[14], [11], [9]],
      PAPIER: [[19], [25], [21]],
      SKLO: [[2], [27], [17]],
      BIO: [[2, 9, 16, 23, 30], [6, 13, 20, 27], [4, 18, 31]],
    },
  );
});
