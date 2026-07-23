# VOXi production readiness summary

Test date: 23 July 2026, UAE

Production URL: <https://voxi-ai.pages.dev/>

Commit preview: <https://97288d6a.voxi-ai.pages.dev/>

StackBlitz URL: <https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

Release commit: `f4a77c5e9ac9006c6500071f9cf8dd431ff1038b`

Cloudflare deployment: `97288d6a-0312-4d6f-a393-ebd5a5db58cd`

Snapshot: `20260723-ba0d4226e0bb646c`

Production asset: `/assets/index-En0aJL-F.js`

## Decision

| Scope | Status | Decision |
| --- | --- | --- |
| Full repository validator | PASS | The complete aggregate validator passed against the July 23 source and snapshot. |
| Production build | PASS | The local release build produced `/assets/index-CTFQKTJo.js` at 891,001 raw bytes, 253,747 gzip bytes, and 228,320 Brotli bytes. |
| Cold-load budget | PASS | The candidate uses one initial JavaScript request and remains within the configured budget. |
| Showtime snapshot | PASS | 10,879 sessions, 35 films, 22 cinemas, and 320 shards cover 2026-07-23 through 2026-08-12. |
| Cloudflare parity | PASS | Production and the commit preview serve `/assets/index-En0aJL-F.js` and snapshot marker `20260723-ba0d4226e0bb646c`. |
| Hosted text and booking E2E | PASS | Discovery recovery, exact booking, seat-derived checkout, FAQ restoration, and seat editing passed. |
| Hosted voice failure recovery | PASS | Controlled Chrome blocked the microphone. The widget showed actionable guidance, re-enabled voice, and retained the active checkout. |
| Successful acoustic voice | MANUAL ACCEPTANCE REQUIRED | Controlled Chrome cannot prove microphone recognition or audible English and Arabic output. |
| ElevenLabs contract | PASS | Contract `2026-07-23.1` was published and read back from the target dashboard. |
| Leadership review | READY WITH DISCLOSED BOUNDARIES | The deployed text, visual, and booking-preview product passed. Acoustic voice and provider transactions remain separate gates. |
| Live ticket sales | BLOCKED BY EXTERNAL APIS | Live inventory, holds, payment, official tickets, provider cancellation, and refunds are not enabled. |

## Current schedule facts

- Extracted at: `2026-07-23T00:36:59.618Z`.
- Snapshot version: `20260723-ba0d4226e0bb646c`.
- Coverage: 2026-07-23 through 2026-08-12.
- Raw sessions: 10,956.
- Deduplicated sessions: 10,879.
- Duplicates removed: 77.
- Scheduled films: 35.
- VOX UAE cinemas: 22.
- Sessions on 23 July: 1,461.
- Sessions on 24 July: 1,389.
- Schedule shards: 320.
- Snapshot bytes: 3,875,067.
- Largest shard: 51,703 bytes.
- Movie-information records: 94.
- Scheduled-film posters: 35, with no missing posters.
- Experience-media records fetched: 14.
- Offer-media records: 21.

This is a validated official public-site snapshot, not a live inventory feed. It does not provide authoritative sold-out status, seat availability, holds, transaction pricing, payment, tickets, cancellation, or refunds.

## Release changes

- Contextual open-choice replies now clear only the single verified unavailable optional criterion.
- Mall of the Emirates and the selected date remain intact when `Anything is fine` follows a French-language no-result.
- Language, genre, experience, audience, time, and movie misses are mapped independently.
- Generic multi-filter conflicts ask which preference to change and do not silently broaden results.
- Hidden stages and replies containing new criteria cannot trigger contextual broadening.
- Time-band-only misses are classified correctly.
- The seat map no longer renders a stray `0` when its optional screen target is null.
- The ElevenLabs prompt matches the same no-result and progressive-discovery rules.
- Voice start, stop, language switch, restart, and inactivity shutdown now use bounded attempt-owned transitions that retire stale transports without clearing a newer conversation.

## Hosted scenarios passed

- Production root loaded directly in text mode without microphone access.
- French movies at Mall of the Emirates tomorrow produced a truthful no-result state.
- `Anything is fine` retained Mall of the Emirates and 24 July, cleared only French, and rendered 12 available movies.
- Minions & Monsters at Mall of the Emirates tomorrow at 8:10 PM opened the correct 20:10 KIDS seat map.
- E1, E2, and E4 produced three tickets and AED 126.
- Checkout displayed the correct movie, cinema, showtime, seats, and total.
- A parking FAQ preserved the current checkout without inventing unverified details.
- Return to checkout restored the same booking summary.
- Edit seats restored the seat map with E1, E2, and E4 selected.
- The former stray zero above the screen label was absent.
- Arabic interface selection and Arabic input retained the active cinema, date, and cards.
- Arabic and English switching retained the active checkout, E1, E2, E4, and AED 126.
- Controlled-browser microphone denial returned to the enabled voice control with specific permission guidance and retained the active checkout.
- When microphone access was blocked, the bounded failure path showed specific guidance, re-enabled voice, and preserved checkout with E1, E2, E4, and AED 126.

## What works

- Text starts without microphone permission.
- Discovery progressively retains cinema, city, date, time, genre, language, experience, movie, and audience preferences.
- Results use all compatible retained criteria.
- Exact and nearest showtime behavior is explicit.
- Exact visible movie and showtime choices route deterministically.
- Contextual no-result recovery changes only the failed optional filter.
- One selected seat equals one ticket, with no independent quantity control.
- Seat changes update ticket count, pricing, fees, and checkout total.
- FAQ and offer detours preserve the active booking journey.
- Checkout can return to the seat map without losing seats.
- Device-local summaries, references, history, and cancellation are clearly disclosed.
- English and Arabic use one shared journey state.
- Detailed bank offers include structured eligibility, cards, limits, experiences, redemption guidance, terms, and official sources where published.
- The protected 420 px white and blue widget remains intact.
- The main production URL serves the current deployment without a query parameter.

## Partially working

- Automated voice configuration, startup classification, and recovery pass. Successful microphone recognition and audible output still require human acceptance in English and Arabic.
- Schedule freshness depends on the daily refresh workflow and successful promotion of validated data.
- Nearby cinema suggestions use repository mappings, not live device location or travel time.
- Public offer sources sometimes omit details. The widget does not invent missing eligibility or terms.

## Blocked or not implemented

- Live seat inventory and seat holds.
- Authoritative price, fee, tax, and offer application.
- Payment authorization or capture.
- Official booking, ticket, and admission QR issuance.
- Cross-device booking lookup.
- Provider cancellation and refund processing.
- Live handover to a customer-care platform.

## ElevenLabs status

Target agent: `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`

Published contract: `2026-07-23.1`

Prompt SHA-256: `12101dcb5d5f89626cfebe68bb5d2d32e835192d2c15edcc96c492a9f6404c5a`

Protected behavior remains unchanged:

- WebRTC voice transport.
- WebSocket text transport.
- `serverLocation: "eu-residency"`.
- Existing eight client-tool names.
- `select_seats`.
- Fuzzy movie and session resolvers.
- Explicit English and Arabic language routing.
- Shared text and voice journey state.

The dashboard prompt was published and reloaded with the July 23 contract. Controlled Chrome passed the permission-denied timeout and state-recovery path. A successful acoustic connection still requires a normal HTTPS browser with a real microphone.

## Evidence

- [Full July 23 validation report](./FINAL_VALIDATION_REPORT_2026-07-23.md)
- [Final local validation log](./evidence/logs/final-local-validation-2026-07-23.md)
- [Final hosted validation log](./evidence/logs/final-hosted-validation-2026-07-23.md)
- [Generated snapshot manifest](./src/generated/voxSnapshotManifest.js)
- [ElevenLabs contract](./config/elevenlabs-agent-contract.json)
- [ElevenLabs setup checklist](./ELEVENLABS_AGENT_SETUP.md)

## Final production-readiness status

Cloudflare text, visual, and booking preview: **PASS FOR LEADERSHIP REVIEW.**

Controlled-browser voice failure and recovery: **PASS.**

Acoustic English and Arabic voice: **PENDING MANUAL ACCEPTANCE.**

Live ticket sales: **BLOCKED BY LICENSED PROVIDER APIS.**
