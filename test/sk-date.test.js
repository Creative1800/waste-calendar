// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { formatSk, parseSk } from '../src/sk-date.js';

// -- formatting -------------------------------------------------------------

test('formatSk pads day and month to two digits', () => {
  assert.equal(formatSk('2026-01-05'), '05.01.2026');
  assert.equal(formatSk('2026-12-31'), '31.12.2026');
});

// -- parsing ----------------------------------------------------------------

test('parseSk reads a full dd.mm.yyyy date', () => {
  assert.equal(parseSk('13.10.2026'), '2026-10-13');
});

test('parseSk accepts unpadded numbers and surrounding spaces', () => {
  assert.equal(parseSk('  1.5.2026 '), '2026-05-01');
});

test('parseSk fills a missing year from the leaflet', () => {
  assert.equal(parseSk('13.10.', { year: 2026 }), '2026-10-13');
  assert.equal(parseSk('13.10', { year: 2026 }), '2026-10-13');
});

test('parseSk rejects a missing year when none is known', () => {
  assert.equal(parseSk('13.10.'), null);
});

test('parseSk rejects days that do not exist in that month', () => {
  assert.equal(parseSk('31.11.2026'), null);
  assert.equal(parseSk('29.02.2026'), null);
});

test('parseSk accepts a real leap day', () => {
  assert.equal(parseSk('29.02.2024'), '2024-02-29');
});

test('parseSk rejects out-of-range and malformed input', () => {
  assert.equal(parseSk('0.10.2026'), null);
  assert.equal(parseSk('13.13.2026'), null);
  assert.equal(parseSk('13-10-2026'), null);
  assert.equal(parseSk('nezmysel'), null);
  assert.equal(parseSk(''), null);
});

test('parseSk and formatSk round-trip', () => {
  const iso = '2026-10-13';
  assert.equal(parseSk(formatSk(iso)), iso);
});
