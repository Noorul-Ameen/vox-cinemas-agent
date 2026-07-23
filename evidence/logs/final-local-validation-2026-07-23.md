# VOXi final local validation evidence

Date: 23 July 2026, UAE

Release commit: `f4a77c5e9ac9006c6500071f9cf8dd431ff1038b`

## Data candidate

- Snapshot: `20260723-ba0d4226e0bb646c`.
- Extracted at: `2026-07-23T00:36:59.618Z`.
- Coverage: 2026-07-23 through 2026-08-12.
- Raw sessions: 10,956.
- Deduplicated sessions: 10,879.
- Duplicates removed: 77.
- Films: 35.
- Cinemas: 22.
- Sessions on 23 July: 1,461.
- Sessions on 24 July: 1,389.
- Schedule shards: 320.
- Snapshot bytes: 3,875,067.
- Largest shard: 51,703 bytes.
- Movie-information records: 94.
- Scheduled-film posters: 35, with no missing posters.
- Experience-media records fetched: 14.
- Offer-media records: 21.

## Automated results

- Atomic schedule refresh and promotion: PASS.
- Full `npm run validate`: PASS.
- `npm run build`: PASS.
- Cold-load budget: PASS.
- Initial JavaScript requests: 1.
- Final local asset: `/assets/index-CTFQKTJo.js`.
- Raw JavaScript: 891,001 bytes.
- Gzip JavaScript: 253,747 bytes.
- Brotli JavaScript: 228,320 bytes.
- Customer-facing punctuation validation: PASS across 494 repository text files.

## Local browser and regression results

- Family discovery at Mall of the Emirates tomorrow around 8 PM: PASS.
- Nearest-time explanation and relevant family movie cards: PASS.
- Exact movie and showtime selection: PASS.
- E1, E2, and E4 selection: PASS.
- Seat-derived ticket count of three: PASS.
- AED 126 checkout total: PASS.
- FAQ detour and return to checkout: PASS.
- Return from checkout to seat map with seats retained: PASS.
- Contextual no-result recovery in English: PASS.
- Contextual no-result recovery in Arabic: PASS.
- Mall of the Emirates and selected date retained during language relaxation: PASS.
- Generic multi-filter conflict clarification without silent broadening: PASS.
- Hidden-stage contextual recovery guard: PASS.
- Time-band no-result classification: PASS.
- Arabic language selector and retained shared journey state: PASS.
- Seat-map stray-zero regression: PASS.
- 420 px layout invariants: PASS.
- Protected ElevenLabs client-tool names and `select_seats`: PASS.
- WebRTC, WebSocket, EU residency, language override, startup classification, and transport recovery validators: PASS.
- Bounded startup, shutdown, language switch, restart, explicit end, inactivity timeout, and stale-attempt retirement: PASS.
- Independent final code review: PASS with no actionable findings.

## Voice boundary

Repository-level voice and transport validation passed. This evidence does not claim a successful live microphone connection for the July 23 hosted deployment. Controlled Chrome blocked microphone access, while the hosted permission-denied timeout and state-recovery path passed. Acoustic English and Arabic acceptance requires real speech and audible output on a normal HTTPS browser.

## Local conclusion

The local source, schedule snapshot, automated suite, production build, cold-load budget, text journeys, booking-preview flow, bilingual logic, and visual rendering passed. Live transaction services and acoustic voice remain outside automated local acceptance.
