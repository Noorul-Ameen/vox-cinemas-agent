# Local and hosted browser acceptance log

Run date: 15 July 2026, Asia/Dubai
Local target: `http://127.0.0.1:5173/`
Hosted target: `https://voxi-ai.pages.dev/`
Viewport: 420 × 850
Automation surface: Codex in-app browser

## Local current-source results

| Scenario | Result | Evidence/observation |
| --- | --- | --- |
| Cinema/date/time supplied in one turn | Pass | “Mall of the Emirates tomorrow at 6:00 PM” did not ask for those fields again. One matching 16 July film was shown with 18:00 plus nearby 18:15/18:30 sessions. |
| Preferred-time filtering and nearest fallback | Pass | A Comedy request around 20:00 returned three matching films and explicitly labelled 19:50, 19:45, 20:15 and 19:40 as the closest times. IMAX around 18:00 explicitly labelled 19:30, 16:00, 23:00 and 12:30 as nearest. |
| Genre filtering | Pass | Comedy at Mall of the Emirates on 15 July returned only the three metadata-matching films. |
| Kids/family filtering | Pass with conversational grounding risk | “Show me kids’ movies tomorrow” asked only for cinema. On 15 July the rendered set contained only Minions & Monsters and Toy Story 5. In one run the ElevenLabs response said there were no kids films while the widget correctly rendered two; this nondeterministic response-grounding issue requires the dashboard prompt/tool-response rule and voice acceptance. |
| Experience filtering | Pass | “Any genre, IMAX instead” retained cinema/date/time and returned only IMAX-compatible sessions with a nearest-time notice. |
| Specific movie | Pass | Toy Story 5 plus cinema/date/time went directly to only that movie’s relevant 18:00, 18:20 and 17:30 sessions. |
| Unknown title | Pass | `NotARealMovie` produced an explicit title clarification and did not widen to all movies. |
| Criteria change invalidation | Pass | Changing the date/time from a seat map with A2 selected removed the seat map, seat selection, price and checkout context before rendering the new filtered result. |
| Ticket target | Pass | “I need three tickets” kept the seat map and displayed “Requested target: 3 seats”; it did not create tickets or show a quantity selector. |
| Seat-derived count and quote | Pass | A2/A3/A4 produced 3 seats and AED 126. Removing A4 immediately produced 2 seats and AED 84; restoring a third seat restored AED 126. |
| FAQ interruption | Pass | “Is IMAX wheelchair accessible?” rendered the approved FAQ; Back restored A2/A3/A4 and AED 126 without rerendering a stale seat map in the transcript. |
| Checkout Back | Pass | Back restored the editable A2/A3/A4 seat map. Replacing A4 with A5 regenerated checkout as A2/A3/A5 with 3 seats and AED 126. |
| Checkout and QR | Pass within the documented boundary | Preview checkout showed subtotal AED 126, fees AED 0 and total AED 126. The supplied preview card generated an on-device booking summary and reference QR with explicit no-payment/no-reservation wording. |
| Current bookings and cancellation | Pass after runtime fix | A cancellation `Yes` initially fell through to movie discovery; the shared text/voice booking-context guard was fixed. Retest kept the booking card visible and showed Cancelled plus “no refund was processed.” |
| Booking-history grounding | Pass after runtime fix | Exact movie, cinema, date, time, experience, screen, seats and total were added to the selected-booking context. Retest described City Centre Deira, A1 and AED 42 without reusing another booking’s fields. |
| Arabic/RTL | Pass | The explicit Arabic control switched the UI/agent. The combined Arabic cinema/date/time request returned one correct 18:00 film and nearby sessions in RTL. |
| Text without microphone | Pass | Text startup connected and completed discovery, seats, checkout, history and cancellation without requesting microphone permission. |
| Voice | Blocked by test-environment permission | Explicit voice startup timed out at microphone permission and recovered to text mode with a localized error. No spoken English/Arabic pass is claimed. Shared transcript routing is covered by automated validators. |
| In-widget Back | Pass | FAQ Back and checkout Back restored the correct parent stage and state. |
| Native browser Back/Forward | Partial/expected full navigation | Browser Back left the single-page app for `about:blank`; Forward reloaded the app successfully and retained the selected locale. In-progress in-memory journey state is not persisted across a full document navigation. |
| Poster/420 px visual | Pass locally with follow-up device sign-off required | Posters were compact; no broken image or document-level horizontal overflow was observed. English and Arabic evidence was captured. Target-device typography and screen-reader review remain manual gates. |

## Hosted Cloudflare results

- Hosted bundle: `assets/index-BgMP9HrN.js`.
- Current local production bundle: `assets/index-B6np26pn.js`.
- The hashes differ, so hosted behavior is not evidence for the current source.
- On the hosted build, changing the request to “July 15 at 6 PM” was misrouted to the 15+/18+/21+ age-rating FAQ and the response incorrectly said only 16 July could be shown.
- Historical hosted checks in this work session also found broad all-day movie rendering, expired same-day session progression, compact working posters, working FAQ/checkout Back, and microphone automation timeout.
- Hosted root and asset responses still use `Cache-Control: public, max-age=0, must-revalidate`; CSP, HSTS and Permissions-Policy from the current repository `_headers` are not present.

## Evidence files

- `evidence/screenshots/local-filtered-combined-420.png`
- `evidence/screenshots/local-checkout-seat-derived-420.png`
- `evidence/screenshots/local-booking-qr-420.png`
- `evidence/screenshots/local-cancellation-confirmed-420.png`
- `evidence/screenshots/local-arabic-filtered-420.png`
- `evidence/screenshots/hosted-old-date-misroute-420.png`
- `evidence/logs/pnpm-run-validate.txt`
- `evidence/logs/pnpm-run-build.txt`
- `evidence/logs/cloudflare-headers.txt`

The in-app browser surface used for this run did not expose a browser-console/network event export. The Vite UI showed no runtime error panel during the tested journeys. Network/security-header evidence is limited to the saved Cloudflare HEAD responses.
