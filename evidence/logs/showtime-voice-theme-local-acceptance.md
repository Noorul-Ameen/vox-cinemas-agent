# Showtime, voice and theme acceptance evidence

Test date: 15 July 2026 (Asia/Dubai)

Scope: current local revision before Cloudflare deployment

## Official VOX UAE refresh

The transactional refresh completed successfully.

```text
extractedAt: 2026-07-15T06:32:40.092Z
programming dates: 2026-07-16..2026-07-22
raw sessions: 9518
deduplicated sessions: 9479
duplicate rows removed: 39
2026-07-16 sessions: 1439
scheduled films: 35
cinemas: 22
session experience codes: 13
retrieved experience records: 14
live offer-media records: 20
```

The refresh staged and validated the extraction before promotion. The refresh implementation checks freshness, tomorrow coverage, crawl completeness, raw/deduplicated reconciliation, source identity, official media URLs and unexpected data drops. It generates and imports the client module and runs repository validation/build before replacing the known-good dataset; failed promotion rolls back both generated files.

Recurring workflow configuration:

```text
daily: 01:30 UTC / 05:30 Asia-Dubai
additional Thursday refresh: 06:30 UTC / 10:30 Asia-Dubai
manual dispatch: enabled
default runner: ubuntu-latest
approved self-hosted override: repository variable VOX_REFRESH_RUNNER
```

This file does not claim that the first GitHub-hosted workflow run has passed.

## Voice diagnosis and fix

Observed hosted root cause: the strict `script-src 'self'` policy blocked the ElevenLabs SDK's generated AudioWorklet `blob:`/`data:` source. The agent ID, WebRTC transport and EU residency setting were not the cause.

Implemented and validated locally:

- self-hosted raw-audio and audio-concatenation worklets;
- explicit worklet paths supplied only to voice startup;
- 45-second microphone-permission bound;
- 45-second transport-start bound;
- English/Arabic permission, device, browser-component, service, timeout and generic error messages;
- strict CSP retained without `blob:` or `data:` in `script-src`;
- WebRTC, `serverLocation: "eu-residency"`, protected client-tool names and `select_seats` unchanged.

This file does not claim a successful microphone session on the not-yet-deployed revision. Hosted desktop/mobile human acceptance remains required.

## Local browser acceptance at 420 px

| Scenario | Result |
| --- | --- |
| Generic “What is playing…” routes to discovery | Pass |
| Combined cinema/date/time filtering | Pass |
| Exact showtime selection | Pass |
| No exact time displays nearest suitable options | Pass |
| Specific Moana filtering | Pass |
| Selected seats are the sole ticket-count source | Pass |
| Add/remove seats recalculates subtotal, fees and total | Pass |
| Checkout Back restores editable seat map | Pass |
| FAQ interruption returns to active booking | Pass |
| Booking confirmation renders local-reference QR | Pass |
| Current booking lookup and local cancellation | Pass |
| Arabic/RTL conversation and rendering | Pass |
| Compact poster, experience and live-offer imagery | Pass |
| White/blue theme and no document-level overflow | Pass |

Two related routing fixes were included in this acceptance run: generic movie-discovery wording no longer falls through to unrelated handling, and deterministic result context is marked authoritative for the conversational agent.

## Visual evidence

- `evidence/screenshots/local-white-blue-july16-420.png`
- `evidence/screenshots/local-generic-filtered-july16-420.png`
- `evidence/screenshots/local-arabic-white-blue-july16-420.png`
- `evidence/screenshots/local-booking-qr-white-blue-420.png`
- `evidence/screenshots/local-checkout-seat-derived-420.png`
- `evidence/screenshots/local-cancellation-confirmed-420.png`

## Remaining acceptance gates

- Deploy the exact tested revision to Cloudflare and record the deployed asset identity.
- Repeat the critical text, Arabic/RTL, Back/Forward, FAQ, media, QR and cancellation checks on the hosted URL.
- Run English and Arabic voice on approved desktop and mobile browsers with microphone permission, confirming that no CSP AudioWorklet error appears.
- Manually dispatch the schedule workflow and record the result; confirm the following scheduled run and alerting path.
- Do not represent preview checkout, local QR or local cancellation as a live sale, official ticket or refund.
