# Kalendár zberu odpadu → `.ics`

Turns the Sabinov waste-collection leaflet (PDF) into a calendar file you import
once into a shared Google Calendar. The calendar then does the reminding — no
server, no cron job, no push service, nothing that can expire or be killed by a
phone's battery optimiser.

Everything runs in the browser. The PDF is never uploaded anywhere.

## How the household uses it

**You, once a year** (when the city publishes a new leaflet):

1. Download the PDF from [sabinov.sk → Aktuality](https://www.sabinov.sk/navstevnik/aktuality).
2. Open the tool, drag the PDF in.
3. Pick your route, check the dates against the leaflet, fix anything wrong.
4. Download the `.ics` and import it into the shared calendar.

**Everyone else, once ever:** accept the shared calendar, set their reminder
preference. After that they do nothing — new dates appear automatically by
account sync.

## Import and reminders

**Import on a computer, not on a phone.** Opening the `.ics` on a phone hands
it to whatever calendar app claims the file type, which may file the events in
a phone-local calendar: it looks right on that phone, syncs nowhere, and shares
with nobody. This happened on the first attempt, 19 October 2026.

1. In Google Calendar on a computer, create a **new calendar** (e.g. "Zber
   odpadu") and share it with the household.
2. **Settings → Import & export → Import**, choose the `.ics`, and set the
   destination to that new calendar.
3. Each person sets a **"1 day before, 18:00"** notification on that calendar in
   their own app. Treat this as required rather than as a fallback — see the
   observation below. Notification settings are also *personal*: your setting
   does not propagate to anyone else.
4. Check each phone once: with the notification set, the next collection should
   show its reminder in that person's own calendar app.

**What was actually observed, 19 October 2026.** A test event whose file asked
for an alarm at 16:30 was imported on a phone and read in Samsung Calendar. It
showed the reminder at 18:00 the day before — the calendar's own default, not
the time in the file — and only fired at 16:30 after that setting was changed
by hand. Which layer substituted it was never established: the events may have
landed in a Google calendar synced to the phone rather than a local Samsung
one, and the two behave differently. The safe reading is the narrow one: **do
not rely on the alarm inside the file; set the per-calendar notification.** The
file still carries an alarm for the calendars that do honour it.

The tool used to offer a downloadable test event with a chosen alarm time. It
was removed once that substitution came to light: the test could only ever
check a setting made by hand beforehand.

One shared Google calendar renders natively in the Google Calendar app, in
iPhone's built-in Calendar (once the Google account is added in iOS Settings →
Calendar), and in Samsung Calendar.

## What it produces

- One all-day event per collection day. Types collected on the same day merge
  into a single event, so `🟢 Sklo + 🟤 Bio` is one notification, not two.
- A check screen in two halves: the same type × month table the leaflet prints,
  for reading next to the paper copy, and an editable list below it for fixing
  anything wrong. Dates read `13.10.2026` whatever language the browser is set
  to, and each one has a 📅 button that opens the browser's own picker. The
  table redraws from your edits, so it always reflects what will be exported.
- Two reminders to fetch the next leaflet, placed 24 and 10 days before the last
  collection in the PDF. They are derived from the parsed data, so they cannot
  drift out of step with it, and they carry both links needed to act on them —
  the city's news page and this tool — because by the time one fires, a year
  has passed and neither is still to hand.
- Stable `UID`s per route and date, so re-importing a regenerated file updates
  existing events rather than duplicating them, wherever the calendar honours
  UIDs.

## Running it

Hosted at **<https://creative1800.github.io/waste-calendar/>** (GitHub Pages)
is the normal path. Locally:

```sh
npm start          # http://localhost:8080
```

A web server is needed even locally: browsers refuse to load ES modules from
`file://` URLs, so opening `index.html` by double-clicking will not work.

```sh
npm test           # 44 unit tests, no browser needed
npm run typecheck  # tsc over the JSDoc types
npm run fixture    # re-extract the test fixture from the sample PDF
node tools/generate.mjs T2   # generate an .ics from the fixture, no browser
```

## Layout

| Path | Role |
|---|---|
| `index.html` | the page |
| `src/pdf-text.js` | the only module that knows pdf.js exists; PDF → `{x, y, s}` items |
| `src/parse-schedule.js` | text items → routes, streets and dates. **Pure** |
| `src/group-events.js` | merges same-day collections. **Pure** |
| `src/renewal.js` | builds the "leaflet runs out" reminders. **Pure** |
| `src/grid.js` | rearranges dates into the leaflet's type × month table. **Pure** |
| `src/sk-date.js` | Slovak date text, both directions. **Pure** |
| `src/labels.js` | Slovak names, month names, bin colours, descriptions |
| `src/build-calendar.js` | assembles the final event list. **Pure** |
| `src/ics.js` | events → RFC 5545 text. **Pure** |
| `src/app.js` | UI glue only — no parsing or calendar logic |
| `vendor/` | pdf.js, committed deliberately. See `vendor/README.md` |
| `tools/` | local server, fixture generator, headless generator |

Vanilla ES modules with `// @ts-check` and JSDoc types. One runtime dependency
(pdf.js), vendored. No framework and no build step, so there is no toolchain to
rot — the tool should still run unchanged in several years.

## Why the parser uses coordinates

The leaflet's raw text stream is not in reading order. Trasa 1's December column
is emitted detached from its row, and the two routes' street lists come out in
reverse. A parser that trusted text order would assign households the wrong
route and the wrong December dates — silently.

So the parser groups text items into rows by `y` and columns by `x`, and never
relies on the order items arrive in. Dates are additionally self-describing
("13.10."), so the month is taken from the date itself and the column header is
used only as a cross-check, which is reported as a warning if the two disagree.

`test/parse-schedule.test.js` pins the expected dates for both routes against the
real 2026 leaflet, so a future leaflet cannot silently break the parser.

## Known limits

- Assumes the PDF contains real text. A scanned leaflet would need OCR, which
  this tool does not do.
- Assumes one calendar year per leaflet; a PDF spanning a year boundary would
  need the year inferred per month rather than from the title.
- Written for the Sabinov leaflet layout (`TRASA n`, Slovak month headers, the
  `TKO / PLASTY / PAPIER / SKLO / BIO` rows). Another town's format would need
  its own parser.
