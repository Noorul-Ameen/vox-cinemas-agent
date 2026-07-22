# VOXi production readiness summary

Test date: 22 July 2026, UAE

Local candidate: <http://127.0.0.1:4173/>

Hosted URL: <https://voxi-ai.pages.dev/>

StackBlitz URL: <https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

Current local snapshot: `20260722-730239f0d90074fb`

Current production asset: `/assets/index-B_jpqGCb.js`

Hosted status for this candidate: revalidation pending

## Decision

| Scope | Status | Decision |
| --- | --- | --- |
| Full repository validator | PASS LOCALLY | The complete aggregate validator passed against the current snapshot and source. |
| Production build | PASS LOCALLY | The final release build produced `/assets/index-B_jpqGCb.js` at 897,497 raw bytes, 252,450 gzip bytes, and 228,683 Brotli bytes. |
| Local browser E2E | PASS | Discovery truth guards, language variants, showtimes, FAQ restoration, checkout repricing, summary and QR, cancellation, bilingual routing, offers, and English and Arabic WebRTC passed with zero error-level console entries. |
| Showtime snapshot | PASS LOCALLY | Snapshot `20260722-730239f0d90074fb` contains 11,126 sessions, 43 films, 22 cinemas, and 341 shards from 2026-07-22 through 2026-08-12. |
| ElevenLabs contract | PASS | Published contract `2026-07-22.2`, protected tools, WebRTC, WebSocket, and EU residency remain verified at repository and dashboard level. |
| Voice transport | PASS LOCALLY | The local browser established English and Arabic WebRTC connections with zero error-level console entries. Hosted transport revalidation for this candidate remains pending. |
| Acoustic voice quality | MANUAL ACCEPTANCE REQUIRED | Automated testing did not speak into a real microphone or judge audible English and Arabic output. |
| Hosted candidate parity | PENDING | The current snapshot and build asset are not yet claimed as deployed on Cloudflare. |
| Leadership review | READY LOCALLY, HOSTED REVIEW PENDING | The local candidate passed its release suite. Leadership should use the hosted URL only after parity and hosted E2E are repeated. |
| Live ticket sales | BLOCKED BY EXTERNAL APIS | Live inventory, holds, payment, official tickets and QR codes, provider cancellation, and refunds are not enabled. |

## Current schedule facts

- Snapshot version: `20260722-730239f0d90074fb`.
- Coverage: 2026-07-22 through 2026-08-12.
- Deduplicated sessions: 11,126.
- Scheduled films: 43.
- VOX UAE cinemas: 22.
- Remaining sessions on 22 July at refresh time: 421.
- Sessions on 23 July: 1,397.
- Schedule shards: 341.
- Official movie-information records: 94.
- Verified runtimes: 93.
- Missing posters: 0.
- Experience-media records: 14.

This is a validated public-site snapshot, not live inventory. It does not provide authoritative sold-out status, seat availability, holds, transaction pricing, or booking mutations.

## Local browser scenarios passed

- Asking about IMAX at Yas Mall without a date asks for the date without making an unverified positive availability claim.
- Same-title language variants resolve correctly for Jana Nayagan and Toxic.
- Arabic questions containing Latin movie titles retain the intended movie.
- Family results at Mall of the Emirates tomorrow around 8 PM are filtered correctly.
- A request without an exact showtime explains this and offers the nearest suitable times.
- Exact movie selection from the visible cards.
- Exact showtime selection from the visible sessions.
- Selecting E1, E2, and E3 produces three tickets and an AED 126 checkout total.
- A parking FAQ detour preserves checkout and the exact journey can be restored.
- A question about another cinema does not leak the active cinema's movie or session details.
- Replacing E1 with E4 produces E2, E3, and E4 with the total unchanged at AED 126.
- Ticket count and checkout total recalculation after every seat change.
- Device-only booking summary and local-reference QR rendering for reference `WLP06WX`.
- Cancellation continuation by listed movie title.
- Hatta requests explain that no VOX cinema is present and offer nearby UAE alternatives.
- French movie no-results remain a language result and do not become a title mismatch.
- The offers view exposes 21 promotions across 20 issuer groups and detailed FAB content.
- English and Arabic interface, conversation, and WebRTC routes connect.
- The final local replay recorded zero error-level console entries. Information and warning entries were transport lifecycle messages only.

## What works in the current candidate

- Progressive discovery retains supplied cinema, date, time, genre, language, experience, movie, and audience criteria.
- Exact visible movies and showtimes route deterministically.
- One selected seat equals one ticket, with no independent quantity control.
- Seat changes update pricing and checkout state.
- FAQ and offer detours preserve the current booking journey.
- Booking summaries and cancellations are stored on the current device with clear disclosures.
- English and Arabic share the same logical journey.
- Detailed bank offers include eligibility guidance, cards, limits, experiences, redemption, terms, and official sources.
- The 420 px white and blue widget remains the protected layout target.

## Partially working

- Voice transport connects, but recognition accuracy and audible TTS quality require manual speak-and-listen acceptance.
- The current candidate is fully validated locally, but Cloudflare parity and hosted E2E have not yet been repeated.
- Schedule freshness depends on the daily refresh workflow and successful deployment of each promoted snapshot.
- Nearby cinema suggestions use repository location knowledge, not live device geolocation or travel time.
- Public bank-offer sources sometimes omit complete card or eligibility terms. The widget does not invent missing details.

## Blocked or not implemented

- Live seat inventory and seat holds.
- Authoritative price, fee, tax, and offer application.
- Payment authorization or capture.
- Official booking, ticket, and admission QR issuance.
- Cross-device booking lookup.
- Provider cancellation and refund processing.
- Live handover to Genesys or OneView.

## ElevenLabs status

Target agent: `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`

Published contract: `2026-07-22.2`

Prompt SHA-256: `8d6747a745286f6b3e8b6acef83762f267eab0649cbb8504b6dc1d9f5d8ae0b8`

Protected behavior remains unchanged:

- WebRTC voice transport.
- WebSocket text transport.
- `serverLocation: "eu-residency"`.
- Existing client-tool names.
- `select_seats`.
- Fuzzy movie and session resolvers.

No new dashboard prompt change is required for this local candidate. After deployment, repeat English and Arabic hosted transport checks. A human must still speak and listen in both languages for acoustic acceptance.

## Evidence

- [Final local validation log](./evidence/logs/final-local-validation-2026-07-22.md)
- [Final local booking render](./evidence/screenshots/final-local-booking-render-2026-07-22.png)
- [Generated snapshot manifest](./src/generated/voxSnapshotManifest.js)
- [ElevenLabs contract](./config/elevenlabs-agent-contract.json)
- [ElevenLabs setup checklist](./ELEVENLABS_AGENT_SETUP.md)

## Final production-readiness status

Local web candidate: **PASS.**

Hosted candidate: **PENDING DEPLOYMENT PARITY AND END-TO-END REVALIDATION.**

Acoustic voice: **PENDING MANUAL ENGLISH AND ARABIC ACCEPTANCE.**

Live ticket sales: **BLOCKED BY LICENSED PROVIDER APIS.**
