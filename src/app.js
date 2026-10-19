// @ts-check
/**
 * UI glue. Holds no parsing or calendar logic of its own -- it reads a PDF,
 * hands the text items to the pure modules, renders what they return, and lets
 * you correct it before export.
 *
 * @typedef {import('./parse-schedule.js').Schedule} Schedule
 * @typedef {import('./parse-schedule.js').Collection} Collection
 * @typedef {import('./parse-schedule.js').WasteType} WasteType
 */

import { extractTextItems } from './pdf-text.js';
import { parseSchedule, WASTE_TYPES } from './parse-schedule.js';
import { groupByDate } from './group-events.js';
import { buildGrid } from './grid.js';
import { formatSk, parseSk } from './sk-date.js';
import { WASTE_LABELS, MONTH_NAMES_SK, eventTitle } from './labels.js';
import { buildCalendar } from './build-calendar.js';
import { buildIcs } from './ics.js';

const $ = /** @type {(id: string) => HTMLElement} */ (
  (id) => /** @type {HTMLElement} */ (document.getElementById(id))
);

/** @type {{schedule: Schedule|null, routeId: string|null, collections: Collection[], include: Set<WasteType>}} */
const state = {
  schedule: null,
  routeId: null,
  collections: [],
  include: new Set(WASTE_TYPES),
};

const today = new Date().toISOString().slice(0, 10);
const weekdayFmt = new Intl.DateTimeFormat('sk-SK', {
  weekday: 'short',
  timeZone: 'UTC',
});

/**
 * @param {string} isoDate
 */
function weekday(isoDate) {
  return weekdayFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

/**
 * Reads Slovak date text, filling in the leaflet's year when it is omitted.
 * @param {string} text
 * @returns {string|null}
 */
function readDate(text) {
  return parseSk(text, { year: state.schedule?.year ?? null });
}

/**
 * @param {string|null} message
 */
function showProblem(message) {
  const box = $('problem');
  box.hidden = !message;
  box.textContent = message ?? '';
}

// -- loading ---------------------------------------------------------------

/**
 * @param {File} file
 */
async function loadPdf(file) {
  showProblem(null);
  const drop = $('drop');
  const original = drop.innerHTML;
  drop.innerHTML = '<p>Spracúvam PDF…</p>';
  try {
    const items = await extractTextItems(await file.arrayBuffer());
    const schedule = parseSchedule(items);
    if (schedule.routes.length === 0) {
      throw new Error(
        'V PDF sa nenašla žiadna trasa. Je to naozaj kalendár zberu odpadu pre rodinné domy?',
      );
    }
    state.schedule = schedule;
    state.routeId = schedule.routes[0].id;
    resetCollections();
    drop.innerHTML = `<p><strong>${file.name}</strong></p><p class="hint">Kliknite pre iný súbor</p>`;
    renderAll();
  } catch (error) {
    drop.innerHTML = original;
    showProblem(
      `PDF sa nepodarilo spracovať: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function resetCollections() {
  const route = state.schedule?.routes.find((r) => r.id === state.routeId);
  state.collections = route ? route.collections.map((c) => ({ ...c })) : [];
}

// -- rendering -------------------------------------------------------------

function renderAll() {
  renderRoutes();
  renderTypeFilters();
  renderPreview();
  for (const id of ['step-route', 'step-types', 'step-preview', 'step-download']) {
    $(id).hidden = false;
  }
}

function renderRoutes() {
  const schedule = state.schedule;
  if (!schedule) return;
  const container = $('routes');
  container.innerHTML = '';
  for (const route of schedule.routes) {
    const label = document.createElement('label');
    label.className = 'route';
    const streets = route.streets.join(', ');
    label.innerHTML = `
      <span class="route-head">
        <input type="radio" name="route" value="${route.id}" ${
          route.id === state.routeId ? 'checked' : ''
        }>
        ${route.label}
        <span style="font-weight:400;color:var(--muted)">
          — ${route.collections.length} zberov
        </span>
      </span>
      <div class="streets">${streets || '—'}</div>`;
    const input = /** @type {HTMLInputElement} */ (label.querySelector('input'));
    input.addEventListener('change', () => {
      state.routeId = route.id;
      resetCollections();
      renderAll();
    });
    container.appendChild(label);
  }
}

function renderTypeFilters() {
  const container = $('type-filters');
  container.innerHTML = '';
  for (const type of WASTE_TYPES) {
    const { emoji, name } = WASTE_LABELS[type];
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${type}" ${
      state.include.has(type) ? 'checked' : ''
    }> ${emoji} ${name}`;
    const input = /** @type {HTMLInputElement} */ (label.querySelector('input'));
    input.addEventListener('change', () => {
      if (input.checked) state.include.add(type);
      else state.include.delete(type);
      renderPreview();
    });
    container.appendChild(label);
  }

  const select = /** @type {HTMLSelectElement} */ ($('add-type'));
  select.innerHTML = WASTE_TYPES.map(
    (t) => `<option value="${t}">${WASTE_LABELS[t].emoji} ${WASTE_LABELS[t].name}</option>`,
  ).join('');
}

/**
 * The leaflet-shaped view: types down the side, months across. Shows every
 * waste type regardless of the filter, because its job is to be compared
 * against the printed leaflet; excluded types are greyed instead of dropped.
 */
function renderGrid() {
  const grid = buildGrid(state.collections);
  const head = $('grid-head');
  const body = $('grid-body');

  head.innerHTML =
    '<th></th>' +
    grid.months
      .map(
        (m) =>
          `<th class="month">${MONTH_NAMES_SK[m.month]}${
            grid.months.some((o) => o.year !== m.year) ? ` ${m.year}` : ''
          }</th>`,
      )
      .join('');

  body.innerHTML = grid.rows
    .map((row) => {
      const { emoji, name } = WASTE_LABELS[row.type];
      const cells = row.cells
        .map((days) =>
          days.length
            ? `<td class="days">${days.join(', ')}</td>`
            : '<td class="days empty">—</td>',
        )
        .join('');
      return `<tr class="${state.include.has(row.type) ? '' : 'off'}">
        <td class="type">${emoji} ${name}</td>${cells}</tr>`;
    })
    .join('');
}

function renderPreview() {
  renderGrid();
  const days = groupByDate(state.collections, { include: [...state.include] });
  const built = currentCalendar();
  const tbody = $('rows');
  tbody.innerHTML = '';

  const renewalDates = new Set(
    built?.events.filter((e) => e.title.startsWith('⚠️')).map((e) => e.date) ?? [],
  );

  for (const day of days) {
    const tr = document.createElement('tr');
    if (day.date < today) tr.className = 'past';
    tr.innerHTML = `
      <td><input type="text" class="date" inputmode="numeric"
                 value="${formatSk(day.date)}" aria-label="Dátum zberu"></td>
      <td class="day">${weekday(day.date)}</td>
      <td><div class="chips"></div></td>`;

    const dateInput = /** @type {HTMLInputElement} */ (tr.querySelector('input'));
    // Mark bad text red while it is being typed, but only move the collection
    // once the field is left or Enter pressed -- re-rendering mid-keystroke
    // would pull the input out from under the cursor.
    dateInput.addEventListener('input', () => {
      dateInput.classList.toggle('invalid', readDate(dateInput.value) === null);
    });
    dateInput.addEventListener('change', () => {
      const next = readDate(dateInput.value);
      if (next === null) {
        dateInput.classList.add('invalid');
        return;
      }
      for (const c of state.collections) {
        if (c.date === day.date) c.date = next;
      }
      renderPreview();
    });

    const chips = /** @type {HTMLElement} */ (tr.querySelector('.chips'));
    for (const type of day.types) {
      const { emoji, name } = WASTE_LABELS[type];
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `${emoji} ${name} <button type="button" title="Odstrániť">×</button>`;
      /** @type {HTMLButtonElement} */ (chip.querySelector('button')).addEventListener(
        'click',
        () => {
          state.collections = state.collections.filter(
            (c) => !(c.date === day.date && c.type === type),
          );
          renderPreview();
        },
      );
      chips.appendChild(chip);
    }
    tbody.appendChild(tr);
  }

  for (const date of renewalDates) {
    const tr = document.createElement('tr');
    tr.className = 'renewal';
    tr.innerHTML = `<td>${formatSk(date)}</td><td class="day">${weekday(
      date,
    )}</td><td>⚠️ Pripomienka: skončí sa kalendár</td>`;
    tbody.appendChild(tr);
  }

  const collectionCount = days.reduce((n, d) => n + d.types.length, 0);
  $('stats').textContent = days.length
    ? `${collectionCount} zberov v ${days.length} dňoch` +
      (days.length
        ? ` · ${formatSk(days[0].date)} – ${formatSk(days[days.length - 1].date)}`
        : '') +
      ` · ${renewalDates.size} pripomienky na nový kalendár`
    : 'Žiadne zbery — skontrolujte vybrané druhy odpadu.';

  renderWarnings(days.length === 0);
  $('download').toggleAttribute('disabled', days.length === 0);
}

/**
 * @param {boolean} empty
 */
function renderWarnings(empty) {
  const box = $('warnings');
  const messages = [...(state.schedule?.warnings ?? [])];
  if (empty) messages.push('Pre vybrané druhy odpadu nie sú žiadne dátumy.');
  if (messages.length === 0) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `<div class="warn"><strong>Skontrolujte:</strong><ul>${messages
    .map((m) => `<li>${m}</li>`)
    .join('')}</ul></div>`;
}

// -- export ----------------------------------------------------------------

/**
 * Builds the calendar from the (possibly edited) collections on screen.
 */
function currentCalendar() {
  const schedule = state.schedule;
  const route = schedule?.routes.find((r) => r.id === state.routeId);
  if (!schedule || !route) return null;
  /** @type {Schedule} */
  const edited = {
    year: schedule.year,
    warnings: [],
    routes: [{ ...route, collections: state.collections }],
  };
  try {
    return buildCalendar(edited, route.id, { include: [...state.include] });
  } catch {
    return null;
  }
}

/**
 * @param {string} filename
 * @param {string} text
 */
function download(filename, text) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadCalendar() {
  const built = currentCalendar();
  if (!built) {
    showProblem('Nie je čo exportovať.');
    return;
  }
  const ics = buildIcs(built.events, { calendarName: built.calendarName });
  const slug = (state.routeId ?? 'trasa').toLowerCase();
  download(`zber-odpadu-${slug}-${state.schedule?.year ?? ''}.ics`, ics);
}

/**
 * A single event tomorrow, so the reminder behaviour of each phone's calendar
 * app can be checked before importing a whole year of events.
 */
function downloadTestEvent() {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const date = tomorrow.toISOString().slice(0, 10);
  const ics = buildIcs(
    [
      {
        date,
        title: `TEST — ${eventTitle(['TKO'])}`,
        description: [
          'Testovacia udalosť. Overte, či upozornenie prišlo dnes o 18:00.',
          '',
          'Ak neprišlo, nastavte pri tomto kalendári upozornenie',
          '„1 deň predtým, 18:00“ v aplikácii na svojom telefóne.',
          '',
          'Túto udalosť potom zmažte.',
        ].join('\n'),
        uid: `sabinov-test-${Date.now()}@waste-calendar.sabinov`,
      },
    ],
    { calendarName: 'Zber odpadu — test' },
  );
  download('zber-odpadu-test.ics', ics);
}

// -- wiring ----------------------------------------------------------------

const drop = $('drop');
const fileInput = /** @type {HTMLInputElement} */ ($('file'));

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('keydown', (event) => {
  const key = /** @type {KeyboardEvent} */ (event).key;
  if (key === 'Enter' || key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});
drop.addEventListener('dragover', (event) => {
  event.preventDefault();
  drop.classList.add('over');
});
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  drop.classList.remove('over');
  const file = /** @type {DragEvent} */ (event).dataTransfer?.files?.[0];
  if (file) loadPdf(file);
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) loadPdf(file);
});

$('add-btn').addEventListener('click', () => {
  const dateInput = /** @type {HTMLInputElement} */ ($('add-date'));
  const typeSelect = /** @type {HTMLSelectElement} */ ($('add-type'));
  const date = readDate(dateInput.value);
  if (date === null) {
    dateInput.classList.add('invalid');
    showProblem('Zadajte dátum nového zberu v tvare 13.10.2026.');
    return;
  }
  dateInput.classList.remove('invalid');
  showProblem(null);
  const type = /** @type {WasteType} */ (typeSelect.value);
  if (!state.collections.some((c) => c.date === date && c.type === type)) {
    state.collections.push({ date, type });
  }
  state.include.add(type);
  dateInput.value = '';
  renderTypeFilters();
  renderPreview();
});

$('download').addEventListener('click', downloadCalendar);
$('download-test').addEventListener('click', downloadTestEvent);
