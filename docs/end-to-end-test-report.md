# VOXi end-to-end validation report

Test date: 23 July 2026, UAE

Build under test: commit `f4a77c5e9ac9006c6500071f9cf8dd431ff1038b`, deployed from `main`

Production URL: <https://voxi-ai.pages.dev/>

Commit preview: <https://97288d6a.voxi-ai.pages.dev/>

Authoritative report: [FINAL_VALIDATION_REPORT_2026-07-23.md](../FINAL_VALIDATION_REPORT_2026-07-23.md)

## Current status

The July 23 release is deployed through Cloudflare deployment `97288d6a-0312-4d6f-a393-ebd5a5db58cd`. Production and the commit preview serve `/assets/index-En0aJL-F.js` and snapshot `20260723-ba0d4226e0bb646c`.

| Area | Status |
| --- | --- |
| Full repository validation | PASS |
| Production build and cold-load budget | PASS |
| Local English and Arabic text journeys | PASS |
| Hosted English discovery and booking replay | PASS |
| Hosted Arabic interface and context retention | PASS |
| Contextual no-result recovery | PASS |
| Seat-derived count and pricing | PASS |
| Checkout, FAQ, and seat-map continuity | PASS |
| 420 px visual rendering | PASS |
| Cloudflare commit, asset, and snapshot parity | PASS |
| ElevenLabs prompt publication and readback | PASS |
| Controlled-browser microphone failure and state recovery | PASS |
| Successful microphone recognition and audible TTS | MANUAL ACCEPTANCE REQUIRED |
| Provider-confirmed payment, ticket, cancellation, and refund | BLOCKED BY EXTERNAL APIS |

## Fresh schedule data

Snapshot `20260723-ba0d4226e0bb646c` contains:

- 10,879 deduplicated sessions;
- 35 films;
- 22 cinemas;
- 21 dates from 2026-07-23 through 2026-08-12;
- 1,461 sessions on 23 July;
- 1,389 sessions on 24 July;
- 320 on-demand cinema and date shards;
- 94 movie-information records;
- 35 scheduled-film posters with none missing;
- 14 experience-media records fetched;
- 21 offer-media records.

The refresh removed 77 duplicate source sessions and atomically promoted only after validation and build success. This public-site snapshot does not provide live sold-out status, seats, holds, authoritative prices, payment, tickets, cancellation, or refunds.

## Automated regression coverage

The full validation suite passed for:

- extraction, freshness, completeness, deduplication, official IDs, posters, media provenance, shards, and runtime loading;
- retained discovery preferences, cinema and location grounding, date authority, genre, audience, language, experience, movie, time, and nearest-time filtering;
- exact visible movie and showtime routing for typed and normalized voice turns;
- movie ratings, child suitability, runtime, synopsis, language variants, and unknown-fact safety;
- contextual zero-result reason mapping and criterion-specific recovery in English and Arabic;
- protection against hidden-stage recovery, ambiguous multi-filter broadening, and combined new-criterion replies;
- seat-derived count, stale selection invalidation, quote updates, checkout return, paused journey restoration, and cancellation safety;
- FAQ, offers, handover redaction, booking persistence, programming dates, and routing invariants;
- English and Arabic interface and conversation state, WebSocket text, WebRTC contracts, startup classification, and transport recovery;
- protected client tools, `select_seats`, EU residency, fuzzy movie and session resolvers, 420 px layout, and customer-facing punctuation.

The final local build produced `/assets/index-CTFQKTJo.js` at 891,001 raw bytes, 253,747 gzip bytes, and 228,320 Brotli bytes. It passed the configured cold-load budget with one initial JavaScript request.

## Hosted end-to-end replay

### Discovery and no-result recovery

1. The production root loaded in text mode without requesting microphone permission.
2. `Suggest some French movies at Mall of the Emirates tomorrow` resolved Mall of the Emirates and 24 July, then returned a truthful French-language no-result.
3. `Anything is fine` removed only the unavailable language criterion.
4. Mall of the Emirates and 24 July remained selected.
5. Twelve available movies rendered.

The Arabic equivalent passed locally using `أي شيء مناسب`, with the same cinema and date retained and the same 12 available movies shown. Shared reducer and routing validation confirms that English and Arabic use the same criterion-recovery logic.

### Exact booking and checkout continuity

1. `Book Minions & Monsters at Mall of the Emirates tomorrow at 8:10 PM` opened the verified 20:10 KIDS session.
2. The seat map rendered without the former stray numeric zero above the screen label.
3. Selecting E1, E2, and E4 produced three tickets and AED 126.
4. Checkout showed the correct movie, cinema, date, time, seats, count, and total.
5. `Where can I park at this cinema?` paused checkout and returned a truthful answer without inventing unverified parking details.
6. The paused summary retained Minions & Monsters, the 20:10 session, E1, E2, E4, and AED 126.
7. Return to checkout restored the exact summary.
8. Edit seats restored the map with E1, E2, and E4 selected.

### Language and voice boundary

- The visible Arabic selector changed the interface route and rendered Arabic input correctly.
- Mall of the Emirates, date, checkout, E1, E2, E4, and AED 126 remained available across Arabic and English language changes.
- The ElevenLabs dashboard prompt contract `2026-07-23.1` was published and read back.
- Controlled Chrome blocked microphone access. The widget exited its bounded startup window with the specific message `Microphone access is blocked. Allow microphone access for this site, then try again.`
- The voice control returned automatically, and the active checkout with E1, E2, E4, and AED 126 was preserved.
- Regression coverage confirms bounded start, stop, language switch, restart, explicit end, and inactivity shutdown with stale-attempt retirement.
- A successful microphone conversation is not claimed. English and Arabic recognition and audible output require a person using a normal HTTPS browser with a real microphone and speakers.

## Cloudflare parity

- Deployment ID: `97288d6a-0312-4d6f-a393-ebd5a5db58cd`.
- Production branch: `main`.
- Commit: `f4a77c5`.
- Deployment status: success.
- Production asset: `/assets/index-En0aJL-F.js`.
- Preview asset: `/assets/index-En0aJL-F.js`.
- Hosted asset bytes: 891,001.
- Hosted gzip bytes: 253,744.
- Hosted Brotli bytes: 228,320.
- Production snapshot marker: `20260723-ba0d4226e0bb646c`.
- Preview snapshot marker: `20260723-ba0d4226e0bb646c`.
- Old snapshot marker: absent.

The production root points to the current deployment. A `deploy` query parameter is not needed.

## Remaining acceptance and external boundaries

Manual acoustic acceptance:

1. Enable the microphone in a normal HTTPS browser.
2. Complete one English voice booking and one Arabic voice booking.
3. Verify recognition, interruption handling, voice continuity, and audible output.
4. Ask an FAQ during checkout and confirm exact restoration by voice.

External API blockers:

- live seat availability and holds;
- authoritative fees, taxes, and bank-offer application;
- payment authorization and capture;
- provider booking and official ticket QR;
- provider booking lookup, cancellation, and refunds;
- live customer-care handover.

## Evidence

- [Full July 23 validation report](../FINAL_VALIDATION_REPORT_2026-07-23.md)
- [Final local validation log](../evidence/logs/final-local-validation-2026-07-23.md)
- [Final hosted validation log](../evidence/logs/final-hosted-validation-2026-07-23.md)
- [Generated snapshot manifest](../src/generated/voxSnapshotManifest.js)
- [Versioned ElevenLabs contract](../config/elevenlabs-agent-contract.json)
- [ElevenLabs publication checklist](../ELEVENLABS_AGENT_SETUP.md)

## Readiness decision

The deployed text, visual, discovery, booking-preview, checkout, FAQ, bilingual interface, and failure-recovery journeys are ready for leadership review. The controlled-browser microphone denial was handled correctly without losing booking state.

Successful acoustic English and Arabic voice remains a manual acceptance gate. Live ticket sales remain blocked until licensed provider APIs are implemented and verified.
