# VOXI end-to-end validation report

Test date: 21 July 2026, UAE

Build under test: current local working tree on `concierge-inline`

Authoritative report: [FINAL_VALIDATION_REPORT_2026-07-21.md](../FINAL_VALIDATION_REPORT_2026-07-21.md)

## Current status

The July 21 changes are local and are **not deployed**. The Cloudflare URL <https://voxi-ai.pages.dev/> may serve an earlier revision and was not validated as containing this working tree. Historical hosted evidence remains useful only for the older revision it names.

| Area | Status |
| --- | --- |
| Local English and Arabic text journeys | PASS |
| Local 420 px mounted-browser inspection | PASS |
| Local movie-result rendering | PASS, approximately 334 to 368 ms in sampled runs |
| Exact visible movie and showtime routing | PASS for typed and normalized voice turns |
| Cold-load budget | PASS, 230,379 of 230,400 Brotli bytes |
| Repository WebRTC, WebSocket, bilingual transport, voice-startup, and protected-invariant checks | PASS |
| Real microphone recognition and TTS | BLOCKED, in-app browser permission request timed out |
| ElevenLabs dashboard language, voice, override, first-message, and tool settings | PASS |
| ElevenLabs dashboard prompt parity | PASS, repository contract `2026-07-21.2` was published and read back |
| Cloudflare validation of the July 21 changes | NOT RUN |
| Provider-confirmed payment, ticket, cancellation, and refund | BLOCKED BY EXTERNAL APIS |

## Local coverage

The current local regression covers:

- explicit English and Arabic interface selection with matching ElevenLabs agent-language override;
- Arabic movie-language requests without automatic interface switching;
- progressive movie discovery filtered by retained cinema, location, date, time, genre, language, experience, movie, and audience criteria;
- unsupported venue rejection and verified VOX UAE alternatives for known areas and cities;
- truthful outside-UAE and no-result responses;
- capitalization-safe location parsing that requires actual place evidence instead of treating any capitalized preference as a location;
- exact and nearby showtime handling;
- deterministic exact visible-title selection to verified showtimes for typed and normalized voice turns;
- deterministic exact visible-time selection to the real session seat map for typed and normalized voice turns, without falling back into discovery filtering;
- a journey-and-view stage guard that keeps delayed agent tools from reopening an older movie or showtime panel;
- FAQ, offer, and topic detours with return to showtimes, seats, checkout, history, or cancellation;
- current-catalog movie, current-session showtime, and current-seat-plan revalidation before a paused movie, showtime, or seat-map stage is restored;
- explicit journey-end and abandonment clearing without clearing progress for ordinary topic or transport changes;
- displayed programming-date authority, explicit guest-date priority, and no silent substitution for an unavailable date;
- seat-derived ticket count and pricing, checkout return, local booking history, and local cancellation;
- detailed bilingual bank-offer content and safe eligibility guidance;
- separate actionable microphone permission and unsupported-browser error guidance;
- customer-facing rejection of Unicode em dash and en dash characters.

The final mounted Arabic replay preserved visible Ezma showtimes during the Arabic selector change, opened the seat map from the Arabic `17:55` choice, and produced a two-seat AED 84 checkout for A6 and A7. An Arabic food FAQ hid checkout, then the Arabic return request restored the exact movie, time, seats, count, and total. Browser error and warning logs were empty. Acoustic voice was not exercised.

## Fresh schedule data

Snapshot `20260721-2cd3483aeb62e458` contains:

- 12,247 sessions;
- 45 films;
- 22 cinemas;
- 23 dates from 2026-07-21 through 2026-08-12;
- 334 on-demand cinema and date shards.

This is a public-site schedule snapshot. It does not provide live sold-out status, authoritative seats, holds, prices, payment, tickets, cancellation, or refunds.

## Voice and ElevenLabs boundary

The protected voice connection remains WebRTC, typed chat remains WebSocket, and `serverLocation: "eu-residency"` remains unchanged. Automated validation covers language overrides, transport recovery, shared journey routing, and the exact client-tool contract.

The target dashboard has the correct bilingual languages, English and Arabic voice setup, Detect language off, agent language override on, text-only override on, `{{voxi_session_opening}}`, EU target, and all eight exact client tools. The exact repository prompt for contract `2026-07-21.2`, prompt value SHA-256 `6424e871a383c06e683850aaa40da85e9c437dc9a6c9ed226888d9853fe88043`, was published, reloaded, and verified with all three new repository rules present. The dashboard showed a clean saved state.

The automated browser could not complete microphone permission, so no live acoustic English or Arabic result is claimed. A real HTTPS-browser microphone and TTS pass remains required after deployment.

## Evidence

- [Full July 21 validation and readiness report](../FINAL_VALIDATION_REPORT_2026-07-21.md)
- [Arabic checkout continuity screenshot](../evidence/screenshots/local-arabic-checkout-continuity-2026-07-21.png)
- [Al Quoz action routing screenshot](../evidence/screenshots/local-al-quoz-action-routing-2026-07-21.png)
- [Final Arabic checkout and FAQ continuity screenshot](../evidence/screenshots/local-final-arabic-checkout-2026-07-21.jpg)
- [Generated snapshot manifest](../src/generated/voxSnapshotManifest.js)
- [Versioned ElevenLabs contract](../config/elevenlabs-agent-contract.json)
- [ElevenLabs publication checklist](../ELEVENLABS_AGENT_SETUP.md)

## Readiness decision

The current local candidate is ready for leadership review with the transaction and acoustic-voice boundaries disclosed. Deployment remains conditional on a final complete validation and production build, deployment of the exact tested commit, and critical Cloudflare text and visual replay. ElevenLabs contract `2026-07-21.2` is already published and dashboard-verified.

Live ticket sales remain blocked until licensed provider APIs are implemented and verified.
