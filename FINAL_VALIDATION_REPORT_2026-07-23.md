# VOXi final validation report

Date: 23 July 2026, UAE

Production URL: <https://voxi-ai.pages.dev/>

Cloudflare preview: <https://97288d6a.voxi-ai.pages.dev/>

Repository: <https://github.com/Noorul-Ameen/vox-cinemas-agent>

Release commit: `f4a77c5e9ac9006c6500071f9cf8dd431ff1038b`

Cloudflare deployment: `97288d6a-0312-4d6f-a393-ebd5a5db58cd`

Snapshot: `20260723-ba0d4226e0bb646c`

Hosted production asset: `/assets/index-En0aJL-F.js`

## Executive status

The July 23 candidate is deployed to Cloudflare production. The production root and commit preview serve the same JavaScript asset and include snapshot marker `20260723-ba0d4226e0bb646c`. The full repository validator, production build, cold-load budget, local browser replay, and critical hosted text replay passed.

The release corrects contextual zero-result recovery, keeps the requested cinema and date when a guest says an open choice such as `Anything is fine`, prevents hidden or ambiguous stages from silently broadening results, and fixes a stray numeric zero above the seat-map screen label. The hosted replay passed movie discovery, no-result recovery, exact booking, seat-derived pricing, checkout, FAQ restoration, and return to the seat map.

The hosted voice-start failure path also completed correctly. Controlled Chrome blocked microphone access, the widget showed the specific permission guidance, restored the enabled voice control, and retained checkout with E1, E2, E4, and AED 126. The repository voice contract and automated bounded startup, shutdown, recovery, language, WebRTC, and WebSocket validators pass, and the ElevenLabs prompt was published and read back. This report does not claim a successful live hosted microphone connection. Real English and Arabic speech recognition and audible output require manual acceptance in a normal HTTPS browser.

Live ticket sales remain blocked by licensed provider APIs.

## Status summary

| Area | Status | Result |
| --- | --- | --- |
| Full repository validator | PASS | The complete aggregate validation suite passed against the July 23 source and snapshot. |
| Production build | PASS | The final local release build produced `/assets/index-CTFQKTJo.js`, 891,001 raw bytes, 253,747 gzip bytes, and 228,320 Brotli bytes. |
| Cold-load budget | PASS | The release stayed within the configured initial-load budget with one initial JavaScript request. |
| Showtime snapshot | PASS | 10,879 deduplicated sessions, 35 films, 22 cinemas, 320 shards, and coverage from 2026-07-23 through 2026-08-12. |
| Cloudflare deployment | PASS | Production deployment `97288d6a-0312-4d6f-a393-ebd5a5db58cd` completed successfully from `main` commit `f4a77c5`. |
| Hosted asset and snapshot parity | PASS | Production and preview both serve `/assets/index-En0aJL-F.js` and contain the July 23 snapshot marker. |
| Contextual no-result recovery | PASS | English hosted and Arabic local replays retained Mall of the Emirates and the selected date while clearing only the unavailable French-language preference. |
| Text discovery and booking | PASS | Filtered discovery, exact showtime selection, seat selection, checkout, FAQ continuity, and seat editing passed. |
| Seat and checkout calculations | PASS | E1, E2, and E4 produced three tickets and an AED 126 total. |
| Visual rendering | PASS | The 420 px seat map no longer renders a stray zero above the screen label. |
| ElevenLabs contract | PASS | Contract `2026-07-23.1` was published and read back from the target dashboard. |
| Hosted controlled-browser voice failure and recovery | PASS | Controlled Chrome blocked microphone access. The bounded start path showed actionable permission guidance, restored the enabled voice control, and retained the active checkout. |
| Acoustic voice | MANUAL ACCEPTANCE REQUIRED | A person must speak and listen in English and Arabic on a normal HTTPS browser. |
| Live transactions | BLOCKED | Inventory, holds, payment, official tickets, provider cancellation, and refunds require external APIs. |

## Current showtime snapshot

- Extracted at: `2026-07-23T00:36:59.618Z`.
- Coverage: 2026-07-23 through 2026-08-12.
- Raw sessions: 10,956.
- Deduplicated sessions: 10,879.
- Duplicate sessions removed: 77.
- Scheduled films: 35.
- VOX UAE cinemas: 22.
- Sessions on 23 July: 1,461.
- Sessions on 24 July: 1,389.
- Schedule shards: 320.
- Snapshot data size: 3,875,067 bytes.
- Largest shard: 51,703 bytes.
- Official movie-information records: 94.
- Official scheduled-film posters: 35, with no missing posters.
- Experience-media records fetched: 14.
- Offer-media records: 21.

The application uses a versioned schedule generated from official VOX UAE public-site sources. It is not a live inventory feed. Sold-out status, seat holds, transaction pricing, payment, official ticket issuance, and provider booking changes are outside snapshot mode.

## Changes validated in this release

### Contextual discovery recovery

- A pure open-choice reply after a verified zero-result screen clears only the failed optional criterion.
- Language, genre, experience, audience, time, or movie filters are relaxed only when that exact criterion is the verified reason for no results.
- Cinema and date remain selected during contextual recovery.
- A generic multi-filter conflict does not silently broaden the request. The guest is asked which criterion to change.
- Hidden stages cannot trigger recovery.
- A reply containing a new cinema, date, time, or content criterion is handled as a new preference update instead of an open-choice relaxation.
- Additional open-choice wording includes `any option works`, `show me what is available`, and `I'm flexible`.
- A time-band-only miss is classified as no suitable time and retains the result count from before the time filter.

### Seat-map rendering

- The screen target now requires a non-null, finite, positive number before it is rendered.
- `Number(null)` can no longer place a stray `0` above the screen label.
- A supporting user-experience regression test covers this condition.

### ElevenLabs prompt contract

- Contract version: `2026-07-23.1`.
- Prompt SHA-256: `12101dcb5d5f89626cfebe68bb5d2d32e835192d2c15edcc96c492a9f6404c5a`.
- Target agent: `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`.
- First message: `{{voxi_session_opening}}`.
- WebRTC voice, WebSocket text, `serverLocation: "eu-residency"`, all eight client-tool names, `select_seats`, explicit language switching, and fuzzy movie and session resolution remain protected.

### Voice transport lifecycle

- Startup, shutdown, language switching, restart, explicit end, and inactivity timeout use bounded operations.
- Each start attempt owns its loading and cleanup state.
- Timed-out or rejected transports retire their captured generation without clearing a newer session.
- Lazy transport mount and microphone permission completion are guarded by the active operation epoch.
- Focused voice-transition regression coverage and an independent code review completed with no actionable findings.

## Automated validation evidence

Result: PASS

The aggregate suite covers:

- Extractor behavior, freshness, counts, deduplication, source IDs, and media provenance.
- Atomic snapshot generation, shards, runtime loading, and cinema-date coverage.
- Progressive discovery, retained criteria, time filtering, exact movie and showtime selection, location grounding, and contextual no-result recovery.
- English and Arabic no-result mapping, hidden-stage protection, generic-conflict clarification, and time-band misses.
- Movie ratings, suitability, runtime, language, genre, synopsis, and unknown-fact safety.
- Seat-derived ticket count, stale-state protection, quote updates, checkout continuity, paused journey restoration, and cancellation safety.
- Offers, FAQ knowledge, handover redaction, booking persistence, programming-date selection, and journey routing.
- English and Arabic interface and conversation routes, WebSocket text, WebRTC voice contracts, startup classification, and transport recovery.
- Protected ElevenLabs configuration, 420 px layout invariants, and customer-facing punctuation.

The final local build passed with:

- Asset: `/assets/index-CTFQKTJo.js`.
- Raw JavaScript: 891,001 bytes.
- Gzip JavaScript: 253,747 bytes.
- Brotli JavaScript: 228,320 bytes.
- Initial JavaScript requests: 1.

Cloudflare rebuilt the same source as `/assets/index-En0aJL-F.js`, 891,001 raw bytes, 253,744 gzip bytes, and 228,320 Brotli bytes. Asset names differ because Cloudflare performs its own build. The source commit, byte count, and snapshot marker were verified instead of assuming local and hosted hash names must match.

## Browser end-to-end evidence

### Hosted English replay

1. The production root loaded directly in text mode without requiring microphone permission.
2. `Suggest some French movies at Mall of the Emirates tomorrow` produced a truthful no-result state for 24 July.
3. `Anything is fine` cleared only the French-language preference, retained Mall of the Emirates and 24 July, and rendered 12 available movies.
4. `Book Minions & Monsters at Mall of the Emirates tomorrow at 8:10 PM` opened the correct 20:10 KIDS session seat map.
5. Selecting E1, E2, and E4 produced three seats and AED 126, with confirmation enabled.
6. Checkout displayed three seats, AED 126, and `Edit seats`.
7. `What is the refund policy?` hid checkout, retained the full booking summary, and returned the grounded refund-policy response.
8. `Return to checkout` restored the same movie, showtime, seats, and total.
9. Switching to Arabic and back to English retained checkout, E1, E2, E4, and AED 126.
10. Controlled-browser microphone denial produced the exact permission guidance, re-enabled voice, and retained checkout.
11. The screen label rendered without the former stray zero.

### Arabic and shared-logic replay

- The visible Arabic language selector changed the interface route to Arabic.
- Arabic input displayed correctly while the selected Mall of the Emirates context, date, and movie cards remained available.
- The Arabic zero-result journey for French movies on 24 July cleared only the unavailable language after `أي شيء مناسب` and rendered the same 12 available movies.
- Text and voice share the same discovery and booking reducers, tool routing, and retained journey state. The repository consistency validators pass. A live hosted microphone connection is still not claimed.

## What works

- Text starts without microphone permission.
- Progressive discovery retains supplied cinema, location, date, time, genre, language, experience, movie, and audience criteria.
- Result filters use all retained compatible criteria.
- Exact and nearby showtime behavior is explicit.
- Contextual open-choice recovery does not discard cinema or date.
- Exact visible movies and showtimes route deterministically.
- One selected seat equals one ticket, with no quantity stage or quantity control.
- Seat changes update count, price, fees, and checkout total.
- Checkout can be paused for an FAQ and restored.
- Checkout can return to the seat map without losing the current selection.
- Booking summaries, local references, history, and cancellation remain device-local and clearly disclosed.
- English and Arabic use one shared logical journey.
- Detailed bank-offer guidance uses structured repository knowledge and official source links.
- The production root serves the current release without requiring a deployment query parameter.

## Partially working

- Controlled Chrome cannot provide an accepted microphone session. Its permission-denied failure and recovery path passes, but it cannot validate a successful acoustic conversation.
- Acoustic recognition and audible TTS quality require a person to test English and Arabic with a real microphone and speakers.
- Schedule freshness depends on the daily refresh workflow and successful validation and deployment.
- Nearby cinema guidance uses repository mappings, not live GPS or travel time.
- Bank-offer accuracy is limited to details published by official sources. Unknown terms are not invented.

## Blocked or not implemented

- Live seat inventory and seat holds.
- Authoritative transaction prices, fees, and taxes.
- Applied bank-offer redemption.
- Payment authorization or capture.
- Provider-confirmed booking and official admission QR.
- Cross-device booking lookup.
- Provider cancellation and refund processing.
- Live customer-care handover.

## Required ElevenLabs follow-up

- Use a normal HTTPS browser with microphone access for successful voice-session acceptance. Controlled Chrome already passed the permission-denied timeout and recovery path.
- Run a normal HTTPS-browser microphone test for English speech recognition and audible English response.
- Switch explicitly to Arabic and repeat microphone recognition and audible Arabic response.
- Confirm that a voice FAQ detour restores the same checkout and seats.
- Preserve the published `2026-07-23.1` prompt unless diagnosis identifies a prompt-specific defect. Do not rename tools or change EU residency.

## Required API and knowledge-base changes

Live transaction readiness requires:

- Licensed VOX session, seat inventory, and hold APIs.
- Authoritative quote, fee, tax, and offer-application services.
- Secure payment and provider booking confirmation.
- Official ticket and QR issuance.
- Booking lookup, provider cancellation, and refund APIs.
- A confirmed customer-care handover connector.

Long-term content accuracy requires:

- Preferably a VOX-owned structured schedule feed.
- Monitoring for refresh, validation, and deployment failures.
- A structured offer feed with card tiers, limits, locations, experiences, expiry, exclusions, and canonical terms URLs.
- Content ownership for expired, blank, or conflicting source pages.

## Evidence

- [Final local validation log](./evidence/logs/final-local-validation-2026-07-23.md)
- [Final hosted validation log](./evidence/logs/final-hosted-validation-2026-07-23.md)
- [Generated snapshot manifest](./src/generated/voxSnapshotManifest.js)
- [ElevenLabs contract](./config/elevenlabs-agent-contract.json)
- [ElevenLabs setup checklist](./ELEVENLABS_AGENT_SETUP.md)

## Final production-readiness status

Text, visual, and booking preview on Cloudflare: **PASS FOR LEADERSHIP REVIEW.**

Hosted controlled-browser voice failure and recovery: **PASS.**

Acoustic English and Arabic voice: **PENDING MANUAL ACCEPTANCE.**

Live ticket sales: **BLOCKED BY LICENSED PROVIDER APIS.**
