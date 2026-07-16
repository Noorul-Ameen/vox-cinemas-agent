# Discovery prompt and movie rendering validation

Date: 2026-07-16

## Reported path

1. Enter `Hi`.
2. Enter `moe` for VOX - Mall of the Emirates.
3. Enter the bare day `17`.
4. Enter `IMAX`.

## Root causes

- The conversational agent interpreted `17` as July 17, but the local booking state did not accept a bare day number.
- The detached date strip remained visible for every discovery state, including after the conversation had moved to another preference.
- The cinema shorthand `moe` could be retained as an unresolved movie title and then incorrectly matched after the date was selected.
- Agent transcript text was not checked against the local card count before being displayed.

## Fixes

- A bare day is resolved only while the first missing criterion is the date, and only when it uniquely matches a published date for the selected cinema.
- Arabic-Indic and Persian digits use the same contextual date resolution.
- Direct cinema-only replies and date-only replies cannot be retained as pending movie titles.
- The date selector is contained inside the date question. It disappears after a date is committed and returns as the normal result-date control only with movie or showtime results.
- Discovery summary chips display a formatted date such as `Fri, 17 Jul` instead of an ISO value.
- Positive movie-display claims and false zero-result claims are checked against the authoritative local render state before entering the transcript.

## Automated evidence

- `pnpm run validate:discovery-prompt`: PASS
- `pnpm run validate`: PASS
- `pnpm run build`: PASS
- `git diff --check`: PASS
- Customer-facing punctuation validation: PASS
- Snapshot data: 22 cinemas, 36 films, 10,567 sessions, 18 published dates

## Browser evidence

The production preview at `http://127.0.0.1:4173/` was reloaded from a fresh build.

- After `moe`, one integrated date question was visible with published date buttons.
- After `17`, the selected date was `Fri, 17 Jul`, the date selector disappeared, and the next-preference question was visible.
- After `IMAX`, `The Odyssey` rendered with its poster and verified IMAX showtimes at 09:00, 12:30, 16:00, 19:30, 23:00, and 02:30.
- No stale date question or empty movie panel remained.
- Browser console log count: 0.

## Result

The exact reported text path now renders the same state described by the conversation. The shared transcript routing and local state code is also used by voice input, and voice parity remains covered by the full validation suite.
