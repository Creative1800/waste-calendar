// @ts-check
/**
 * Renders events as an RFC 5545 iCalendar file.
 *
 * Events are all-day on the collection day, with an alarm six hours before
 * midnight -- i.e. 18:00 the previous evening. Apple Calendar honours that
 * alarm on import. Google does not: it discards it and applies the destination
 * calendar's own default notification (confirmed on import, 19 October 2026),
 * which is why each person must set a per-calendar reminder of their own. The
 * alarm stays in the file for the calendars that do read it.
 *
 * @typedef {{date: string, title: string, description: string, uid: string}} CalEvent
 */

const PRODID = '-//waste-calendar//Sabinov//SK';

/** Alarm offset from the start of the all-day event: 18:00 the day before. */
const ALARM_TRIGGER = '-PT6H';

const encoder = new TextEncoder();

/**
 * @param {string} s
 * @returns {number} length of s in UTF-8 octets
 */
function utf8Length(s) {
  return encoder.encode(s).length;
}

/**
 * Folds a content line to 75 octets as RFC 5545 requires. Iterating code
 * points (not UTF-16 units) keeps multi-byte characters intact across folds.
 * @param {string} line
 * @returns {string}
 */
export function foldLine(line) {
  /** @type {string[]} */
  const parts = [];
  let current = '';
  let bytes = 0;
  // Continuation lines spend one octet on their leading space.
  let budget = 75;
  for (const ch of Array.from(line)) {
    const size = utf8Length(ch);
    if (bytes + size > budget) {
      parts.push(current);
      current = '';
      bytes = 0;
      budget = 74;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * Escapes a TEXT value: backslash first, or it would double-escape the rest.
 * @param {string} s
 * @returns {string}
 */
export function escapeText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/**
 * "2026-12-31" -> "20261231"
 * @param {string} isoDate
 */
function toIcsDate(isoDate) {
  return isoDate.replace(/-/g, '');
}

/**
 * The exclusive end date of a one-day all-day event.
 * @param {string} isoDate
 */
function nextDay(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return toIcsDate(d.toISOString().slice(0, 10));
}

/**
 * @param {Date} date
 * @returns {string} UTC timestamp in iCalendar form
 */
function toIcsStamp(date) {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/**
 * Builds the .ics text.
 *
 * @param {CalEvent[]} events
 * @param {{calendarName: string, now?: Date}} options
 * @returns {string}
 */
export function buildIcs(events, options) {
  const stamp = toIcsStamp(options.now ?? new Date());
  /** @type {string[]} */
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(options.calendarName)}`,
    'X-WR-TIMEZONE:Europe/Bratislava',
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toIcsDate(event.date)}`,
      `DTEND;VALUE=DATE:${nextDay(event.date)}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      `TRIGGER:${ALARM_TRIGGER}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(event.title)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
