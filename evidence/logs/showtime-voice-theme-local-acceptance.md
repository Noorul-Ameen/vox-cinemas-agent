# Showtime, voice and theme acceptance evidence

Test date: 15 July 2026 (Asia/Dubai)

Historical scope: local revision before Cloudflare deployment

Final hosted acceptance and the subsequent 9,460-session Actions refresh are recorded separately in `hosted-acceptance-2026-07-15.md`. The figures below preserve the initial local extraction evidence.

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

[GitHub Actions run 29396366283](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/29396366283) subsequently passed the complete refresh path. [Run 29397059917](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/29397059917) then passed end to end on `checkout@v7`, `setup-node@v7` and `setup-python@v6`, committing the current 9,460-session dataset as `1cf0d56`.

## Voice diagnosis and fix

Observed hosted root cause: the original `script-src 'self'` policy blocked an ElevenLabs SDK-generated AudioWorklet source. The agent ID, WebRTC transport and EU residency setting were not the cause.

Implemented and validated locally:

- self-hosted raw-audio and audio-concatenation worklets;
- explicit worklet paths supplied only to voice startup;
- 45-second microphone-permission bound;
- 45-second transport-start bound;
- English/Arabic permission, device, browser-component, service, timeout and generic error messages;
- restrictive CSP retained with `blob:` permitted only because ElevenLabs React 0.7.1's secondary WebRTC output-capture worklet ignores `workletPaths`; `data:` remains blocked;
- WebRTC, `serverLocation: "eu-residency"`, protected client-tool names and `select_seats` unchanged.

Signed-in Chrome subsequently passed hosted voice startup: `Voice chat`, agent greeting and `End voice` were present with zero console warnings/errors. Arabic voice and broader physical mobile acceptance remain required for customer-launch qualification.

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

- Observe the next naturally scheduled refresh and alerting path; two manual runs passed end to end.
- Complete Arabic voice and physical desktop/mobile browser coverage; signed-in hosted Chrome voice passed.
- Complete accessibility, performance and production API/security acceptance.
- Do not represent preview checkout, local QR or local cancellation as a live sale, official ticket or refund.
