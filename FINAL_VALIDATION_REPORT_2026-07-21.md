# VOXI Final Validation Report

Date: 21 July 2026, UAE

Scope: feature commit `98e543f4b14019723b084e9eb0602a541d6f3358`, deployed from `main`

Local validation URL: <http://127.0.0.1:4174/>

Public URL: <https://voxi-ai.pages.dev/>

## Executive status

The deployed candidate passes the tested text journeys, deterministic repository checks, 420 px visual inspection, protected ElevenLabs transport contract, and critical Cloudflare production replay. It improves explicit English and Arabic transport switching, retained booking context, grounded location routing, availability filtering, and initial movie-result performance.

Feature commit `98e543f4b14019723b084e9eb0602a541d6f3358` was pushed to `main`. Its Cloudflare Pages check completed successfully, its production bundle `/assets/index-uT8EEHGH.js` was served from <https://voxi-ai.pages.dev/>, and snapshot `20260721-2cd3483aeb62e458` was verified as JSON on the production domain. The commit-specific preview is <https://712e42d6.voxi-ai.pages.dev/>.

Voice WebRTC configuration and code-level routing tests pass. A real acoustic microphone and TTS exchange was not validated because the in-app browser permission request timed out. ElevenLabs dashboard language, voice, residency, override, first-message, and tool settings are correct. The exact repository prompt for contract `2026-07-21.2` was published, reloaded, and verified in the signed-in dashboard.

## Status summary

| Area | Status | Evidence-based result |
| --- | --- | --- |
| Text journeys | PASS LOCALLY AND ON CLOUDFLARE | English and Arabic discovery, filtering, location routing, showtimes, seats, checkout continuity, FAQ pause and restore, and cancellation routing use the same journey state. |
| Arabic interface and agent transport | PASS LOCALLY AND ON CLOUDFLARE | Explicit selector or confirmed language command restarts the active text or voice transport with `overrides.agent.language` set to `ar` or `en` while preserving journey context. |
| Arabic movie-language request | PASS LOCALLY AND ON CLOUDFLARE | Arabic script alone does not switch the interface. A request for Arabic movies remains a movie-language filter unless the guest explicitly requests an interface language change. |
| Showtime and movie rendering | PASS LOCALLY AND ON CLOUDFLARE | Rich local results rendered in approximately 334 to 368 ms in sampled mounted-browser runs. Production serves the same sharded snapshot and budgeted bundle. The remaining longer delay is the deferred ElevenLabs SDK, WebSocket, or model response, not the local movie data renderer. |
| Grounded availability | PASS LOCALLY AND ON CLOUDFLARE | Cinema, city, date, time, genre, language, experience, movie, and audience preferences are retained and checked against available sessions before results are shown. |
| Unsupported locations | PASS LOCALLY AND ON CLOUDFLARE | Known unsupported venues are not fuzzy-matched to a different cinema. UAE areas route to verified VOX choices, and outside-UAE requests receive a truthful UAE-only response. Nearby suggestions use the repository's known area and city mapping, not live device geolocation. |
| Exact visible-movie selection | PASS LOCALLY AND ON CLOUDFLARE | An exact displayed title or explicit selection phrase deterministically loads that movie's verified showtimes for both typed and normalized voice turns. Generic or information-only references do not silently select a movie. |
| Exact visible-showtime selection | PASS LOCALLY AND ON CLOUDFLARE | An exact visible time or explicit English or Arabic showtime phrase deterministically opens that session's seat map for typed and normalized voice turns. It is not reinterpreted as a new discovery time filter. Ambiguous same-time experiences and information-only questions remain non-selecting. |
| Booking context continuity | PASS LOCALLY AND ON CLOUDFLARE | FAQ and topic detours can return to the revalidated showtime, seat, checkout, history, or cancellation stage in the same page session. Delayed agent tool calls cannot replace a newer guest-selected stage. |
| Paused-stage freshness | PASS LOCALLY | Restored movies, showtimes, and seat maps are checked against the current catalog, current sessions, and current seat plan. Expired or unavailable items are not resurrected from a stale snapshot. |
| Journey lifecycle and date authority | PASS LOCALLY | Only an explicit journey end or abandonment clears active progress. A visible selection keeps its displayed programming date unless the guest explicitly supplies a different date, and an unavailable explicit date is never substituted silently. |
| Seat and checkout flow | PASS LOCALLY | One selected seat equals one ticket. Seat changes update count and price. Checkout can return to the seat map and restore the selected order. |
| Repository voice contract | PASS | Voice remains WebRTC, text remains WebSocket, EU residency is preserved, and language override and shared text or voice routing are covered by validators. |
| Voice startup error guidance | PASS | Permission-blocked and browser-unsupported microphone failures are classified separately and return actionable bilingual text guidance without clearing the journey. |
| Acoustic voice and TTS | BLOCKED BY TEST ENVIRONMENT | The controlled in-app browser did not complete the microphone permission request. No spoken English or Arabic acceptance claim is made. |
| ElevenLabs dashboard settings | PASS | English and Arabic, English primary, Arabic voice override, Detect language off, agent language override on, text-only override on, first-message variable, EU target, and all eight exact client tools were verified read-only. |
| ElevenLabs dashboard prompt | PASS | The exact repository prompt for contract `2026-07-21.2` was published and read back. The three new language-intent, unsupported-location, and retained-availability rules were present, and the dashboard showed a clean saved state. |
| Cloudflare current-change validation | PASS | GitHub reported `Deployed successfully` for feature commit `98e543f`. Production served the expected bundle and snapshot. Critical English and Arabic text, visual, navigation, availability, unsupported-location, seat, checkout, FAQ, and restore scenarios passed with empty browser logs. |
| Live customer transaction APIs | BLOCKED | Seat holds, authoritative prices, payments, official tickets and QR codes, provider cancellation, and refunds need licensed server APIs. |
| Cold-load budget | PASS LOCALLY | Initial JavaScript Brotli was 230,379 bytes against the 230,400-byte limit. This leaves 21 bytes of headroom, so the final build must be rechecked after any source change. |

## Fresh showtime snapshot

The validated local schedule source is snapshot `20260721-2cd3483aeb62e458`:

- Extracted at `2026-07-21T11:52:23.208Z`.
- 12,247 deduplicated sessions from 12,322 source rows.
- 45 films.
- 22 VOX UAE cinemas.
- 23 programming dates from 2026-07-21 through 2026-08-12.
- 334 cinema and date shards.
- 4,361,304 total shard bytes, with a 50,625-byte largest shard.
- 874 sessions on 21 July and 1,338 sessions on 22 July.

The official available-day crawl stopped because the upstream published days were exhausted. This snapshot is current for the report date, but it is not a substitute for live inventory, sold-out status, or a licensed booking API.

## What works

- Progressive discovery asks only for missing information and filters by all retained criteria.
- Exact cinema, broad UAE city, common UAE area, unknown venue, unsupported venue, and outside-UAE routing are handled without inventing a cinema.
- Exact and nearest-time behavior remains available when no requested showtime exists.
- Arabic movie filtering and Arabic interface selection are separate intents.
- Explicit language switching changes the real ElevenLabs session language for both text and voice transport and retains current journey context.
- Saying or typing one exact title from the visible cards, including an explicit English or Arabic selection phrase, routes directly to that title's verified showtimes. Generic phrases and requests for information remain non-selecting.
- Saying or typing one exact visible showtime, including an explicit Arabic time choice, routes directly to that real session's seat map. The time is not sent back through movie discovery as a new preference when the guest is selecting from the showtimes already on screen.
- Movie cards, showtimes, seat map, checkout, booking history, cancellation, FAQ, offers, and handover use one logical conversation state.
- The deterministic stage guard remains active while the same journey and guest-selected showtime or seat view remain visible. A delayed model or client-tool response cannot reopen an older movie or showtime panel after the guest has progressed.
- FAQ or offer questions temporarily hide, but do not destroy, the current showtime, seat, checkout, history, or cancellation stage.
- Restoring paused movies reloads the current film and session catalog, restoring showtimes keeps only still-current captured sessions, and restoring a seat map rechecks its session and selected seats against the current seat plan.
- Explicit conversation-end and active-journey-abandonment requests clear the current journey. FAQ detours, language changes, voice or text transport changes, and existing-booking cancellation do not clear unrelated active progress.
- A selected visible movie or showtime retains the programming date of the list on screen. An explicit guest date has higher authority, and an unavailable requested date returns a no-substitution result.
- Location parsing requires real location evidence. Capitalized movie, genre, language, time, or preference text is not treated as an unknown place merely because it begins with a capital letter.
- Selected seats alone determine ticket count, subtotal, fees, and checkout total. There is no independent quantity stage.
- Completed and cancelled device-local booking records remain in browser localStorage.
- Bank-offer detail remains grounded in the repository's sourced offer catalogue and never requests card numbers, CVV, OTP, passwords, or bank credentials.
- Static and runtime validation reject Unicode em dash and en dash characters in customer-facing content.

## What does not work as a live transaction

- Checkout does not charge a payment method or reserve a cinema seat.
- The generated QR identifies a device-local booking summary and is not an official admission ticket.
- Cancellation changes a device-local booking record. It does not cancel a provider reservation or issue a refund.
- Seat availability, pricing, sold-out state, offer redemption, and booking status are not authoritative without provider gateways.
- Cross-device booking recovery is not available.

## Partially working or environment-dependent

- Voice application logic, transport selection, Arabic override, recovery, and transcript routing pass. Real microphone recognition, audio quality, and Arabic or English TTS remain a manual HTTPS-browser test.
- Microphone permission denial or timeout now produces permission guidance, while an unavailable capture API or unsupported browser produces supported-browser guidance. This correct classification does not prove acoustic input or output.
- Journey context survives FAQ detours, language changes, and text or voice transport restarts in the current page session. A full browser refresh resets an unfinished journey. Saved bookings remain device-local.
- The deployed schedule is a refreshed, versioned public-site snapshot. Ongoing freshness depends on the scheduled refresh workflow and deployment of each promoted snapshot.
- Local movie rendering is fast in the sampled browser run. First conversational-agent response time still depends on SDK loading, network latency, WebSocket or WebRTC setup, and ElevenLabs model latency.

## ElevenLabs published state and remaining validation

Target agent: `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`

Repository contract: `2026-07-21.2`

Prompt value SHA-256: `6424e871a383c06e683850aaa40da85e9c437dc9a6c9ed226888d9853fe88043`

Keep these verified dashboard settings unchanged:

- English primary language and Arabic additional language.
- The configured English voice and Arabic voice override.
- Detect language off.
- Agent language override on.
- Text-only override on.
- First message exactly `{{voxi_session_opening}}`.
- All eight exact client-tool names and wait-for-response behavior.
- WebRTC voice, WebSocket text, and `serverLocation: "eu-residency"`.

The complete `VOXI_AGENT_PROMPT` value from `src/lib/voxiSession.js` was published and reloaded in the signed-in dashboard. Contract `2026-07-21.2`, the first message, and the clean saved state were verified. The read-back included the final rules for:

- distinguishing a movie-language request from an interface-language change;
- rejecting unsupported locations without a fabricated fuzzy cinema match;
- verifying availability across all retained cinema, location, date, time, genre, language, experience, movie, and audience criteria before responding.

No further prompt edit is required for the current repository contract. Live English and Arabic text checks are complete. One real microphone and TTS check in each language remains required. Do not rename tools or change the protected transport configuration.

## API and knowledge-base changes required

For production transactions:

- Licensed film, showtime, live seat inventory, and seat-hold APIs.
- Authoritative quote, fee, and offer-application APIs.
- Secure payment authorization and provider booking confirmation.
- Official ticket and QR issuance.
- Cross-device booking lookup.
- Provider cancellation eligibility, mutation, refund outcome, and refund reference.
- A confirmed customer-care handover connector if live transfer is required.

For sustained content accuracy:

- A VOX-owned structured showtime feed or scheduled public-source refresh with deployment monitoring.
- A structured bank-offer or CMS feed, with promotion IDs, eligible cards, limits, locations, experiences, expiry, and terms URLs.
- Content ownership and alerts for blank, changed, expired, or conflicting offer pages.

## Test and visual evidence

Local mounted-browser scenarios included:

- Arabic movie requests without interface switching.
- Explicit English and Arabic selector and command switching.
- Unsupported Abu Dhabi Marina Mall without a false Abu Dhabi Mall match.
- Outside-UAE Doha request without a fabricated cinema.
- Dubai Arabic and Tamil availability filtering.
- Exact-cinema zero-result messaging.
- Movie to showtime and showtime to seat progression under delayed agent responses.
- Exact visible-title selection through typed and normalized voice routes, with generic and information-only phrases rejected as selections.
- Exact visible-showtime selection through typed and normalized voice routes, with ambiguous same-time experiences and information-only questions kept non-selecting.
- FAQ pause and return to showtimes, seats, and checkout.
- Current-catalog, current-session, and seat-plan checks while restoring paused movie, showtime, and seat-map stages.
- Explicit journey clearing, displayed-date authority, unavailable-date no-substitution, and capitalization false-positive location regressions.
- Seat-derived checkout with two seats and recalculated total.
- Al Quoz action-movie routing to verified cinemas.

Final mounted Arabic continuity replay:

1. The English to Arabic selector change preserved the visible Ezma showtimes.
2. The Arabic selection of the visible `17:55` showtime opened that session's seat map.
3. Selecting seats A6 and A7 produced a two-seat checkout totaling AED 84.
4. An Arabic food FAQ hid the checkout while preserving the unpaid order.
5. The Arabic return-to-checkout request restored Ezma, `17:55`, seats A6 and A7, two tickets, and AED 84.

The local and Cloudflare mounted browsers recorded no console errors or warnings during the critical replay. Acoustic microphone recognition and TTS were not exercised.

Cloudflare production replay also verified:

1. An Arabic-script request for Arabic movies kept the English interface and returned only verified Arabic films at Mall of the Emirates for the requested date.
2. Typing `I choose Ezma` replaced the movie list with Ezma's verified showtimes.
3. The Arabic selector changed the interface and active ElevenLabs text transport language while preserving the visible showtime stage.
4. An Arabic `17:55` selection opened the seat map, and A6 plus A7 produced the same two-seat AED 84 checkout.
5. An Arabic food FAQ hid checkout, and the Arabic return request restored the exact movie, time, seats, ticket count, and total.
6. Roxy Cinemas Boxpark was rejected as a non-VOX venue, with Mercato, Burjuman, and Wafi Mall at Wafi City offered as nearby verified alternatives.
7. A Korean-language request with no matching sessions returned an explicit no-result state instead of invented movies.
8. Browser back and forward navigation completed without application errors.

Screenshots:

- [Arabic checkout continuity](./evidence/screenshots/local-arabic-checkout-continuity-2026-07-21.png)
- [Al Quoz action routing](./evidence/screenshots/local-al-quoz-action-routing-2026-07-21.png)
- [Final Arabic checkout and FAQ continuity](./evidence/screenshots/local-final-arabic-checkout-2026-07-21.jpg)
- [Cloudflare Arabic checkout restored](./evidence/screenshots/cloudflare-arabic-checkout-restored-2026-07-21.jpg)

Repository evidence:

- [Generated snapshot manifest](./src/generated/voxSnapshotManifest.js)
- [ElevenLabs versioned contract](./config/elevenlabs-agent-contract.json)
- [ElevenLabs setup and publication checklist](./ELEVENLABS_AGENT_SETUP.md)
- `pnpm run validate` covers showtime extraction and data, snapshot integrity, discovery filters, location availability, deterministic visible-movie and visible-showtime selection, authoritative programming dates, annotated journeys, paused-stage revalidation, explicit lifecycle clearing, seats, checkout continuity, cancellation, offers, FAQ, bilingual transport, ElevenLabs contract, classified voice startup errors, protected invariants, and customer-facing punctuation.
- `pnpm run build` enforces the production build and cold-load budgets.

## Final production-readiness status

**Leadership review of the deployed candidate: READY WITH DISCLOSED BOUNDARIES.**

**Web deployment readiness: PASS.** The complete validator and production build passed on the promoted source, Cloudflare deployed the commit successfully, and the critical English and Arabic text and visual journeys passed on the production domain. The ElevenLabs prompt contract is published and dashboard-verified.

**Acoustic voice readiness: PENDING.** A normal HTTPS browser with an available microphone must complete English and Arabic microphone and TTS acceptance.

**Live ticket-sale readiness: BLOCKED BY EXTERNAL APIS.** The repository is truthful about this boundary and must not represent device-local checkout, QR, cancellation, or refund state as provider-confirmed.
