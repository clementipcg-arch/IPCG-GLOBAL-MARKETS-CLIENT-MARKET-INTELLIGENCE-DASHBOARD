'use strict';
// Time helpers. All client-facing times are shown in Singapore time (SGT, UTC+8, no DST).

const SGT = 'Asia/Singapore';

function fmt(date, opts, tz = SGT) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).format(date);
}

/** "29 Oct 2026, 11:47 SGT" */
function sgtLabel(date = new Date()) {
  return `${fmt(date, { day: '2-digit', month: 'short', year: 'numeric' })}, ${fmt(date, { hour: '2-digit', minute: '2-digit', hour12: false })} SGT`;
}

/** YYYY-MM-DD for a date as seen in a given time zone. */
function isoDateIn(date, tz = SGT) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return p; // en-CA yields YYYY-MM-DD
}

/**
 * Convert a wall-clock time in an IANA zone to a UTC Date.
 * e.g. zonedToUtc('2026-10-29', '14:15', 'Europe/Berlin')
 */
function zonedToUtc(isoDate, hhmm, tz) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const [hh, mm] = (hhmm || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Offset of tz at that instant
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
  const g = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute);
  const offset = asUtc - guess;
  return new Date(guess - offset);
}

/** Count weekdays (Mon-Fri) strictly after a and up to and including b. Market holidays are not modelled here. */
function weekdaysBetween(aIso, bIso) {
  let n = 0;
  const d = new Date(aIso + 'T00:00:00Z');
  const end = new Date(bIso + 'T00:00:00Z');
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

module.exports = { SGT, fmt, sgtLabel, isoDateIn, zonedToUtc, weekdaysBetween };
