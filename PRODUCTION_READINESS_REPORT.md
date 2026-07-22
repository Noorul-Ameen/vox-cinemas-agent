# VOXi production readiness summary

Test date: 22 July 2026, UAE

Public URL: <https://voxi-ai.pages.dev/>

StackBlitz URL: <https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

Production branch: `main`

Validated hosted code release: commit `0030943cb5cb3290f85a044c9d2677b54bad4e21`, bundle `/assets/index-CSjTLhgw.js`

Final corrective release: deployed and hosted replay passed

## Decision

| Scope | Status | Decision |
| --- | --- | --- |
| Repository feature set | PASS | Progressive discovery, bilingual text, exact movie and showtime selection, seats, checkout continuity, booking history, cancellation, FAQ, and bank offers passed the tested local and hosted journeys. |
| Final corrective release | PASS LOCALLY AND ON CLOUDFLARE | Movie-rating grounding, short movie-detail follow-ups, movie-filter routing, Hatta alternatives, language-aware retained notices, and the earlier journey corrections passed the complete validator, production build, mounted-browser replay, deployment parity check, and final hosted replay. |
| Showtime snapshot | PASS | Snapshot `20260722-9494582985db4292` contains 11,716 deduplicated sessions, 45 films, and 22 cinemas from 2026-07-22 through 2026-08-12. |
| Bank offers | PASS WITH SOURCE LIMITATIONS | The widget contains 21 promotions across 20 offer groups, rich English and Arabic detail, card and experience guidance, redemption instructions, terms, and official links. Incomplete source terms are disclosed instead of invented. |
| ElevenLabs repository contract | PASS | WebRTC voice, WebSocket text, EU residency, eight client tools, explicit English or Arabic override, state variables, and the first-message contract pass repository validation. |
| ElevenLabs published agent | PASS | Contract `2026-07-22.2` was published to the exact target agent, reloaded, and read back from the signed-in dashboard. |
| Live ElevenLabs text | PASS | English and Arabic hosted text sessions reached the published agent and retained the shared widget journey. |
| Live voice transport | PASS ON CLOUDFLARE | The hosted widget established English WebRTC voice, restarted into Arabic voice while retaining context, and stopped cleanly. Acoustic speech-recognition and audible TTS quality still require a person to speak and listen. |
| Leadership review | READY WITH DISCLOSED BOUNDARIES | The final corrective release passed the tested web journeys. Acoustic voice acceptance and live transaction APIs remain outside this pass. |
| Live ticket sales | BLOCKED BY EXTERNAL APIS | Seat holds, authoritative prices, payment, official tickets and QR codes, cross-device booking lookup, provider cancellation, and refunds are not enabled. |

## Current product facts

- Snapshot version: `20260722-9494582985db4292`.
- Extraction time: `2026-07-22T04:45:48.076Z`.
- Coverage: 22 programming dates from 2026-07-22 through 2026-08-12.
- Source rows: 11,793.
- Deduplicated sessions: 11,716.
- Duplicates removed: 77.
- Scheduled films: 45.
- VOX UAE cinemas: 22.
- Sessions on 22 July: 1,368.
- Sessions on 23 July: 1,376.
- Runtime shards: 320, totaling 4,171,104 bytes.
- All promoted movie records have official poster coverage.

The snapshot is derived from the official VOX UAE public site and API-facing routes. It is not a live inventory feed. Sold-out status, current seat availability, holds, transaction prices, and booking mutations require licensed server APIs.

## What works

- Text chat starts without microphone permission.
- English and Arabic interface selection changes the active ElevenLabs language override and preserves the current journey.
- Arabic text that asks for Arabic-language movies is handled as a content filter, not automatically as an interface-language switch.
- Discovery retains cinema, city, date, preferred time, genre, movie language, experience, movie, and audience criteria.
- Information already supplied by the guest is not requested again in the tested flows.
- Specific-movie requests show only that movie's relevant sessions.
- Movie age-rating questions use the published UAE certificate. A PG15 age-10 question explains the 15-or-older accompaniment rule and leaves final suitability to a parent or guardian.
- Runtime, language, genre, synopsis, subtitle status, cast, trailer, release date, and review-score questions use only current catalog facts. Missing facts are stated as unavailable instead of invented.
- An explicitly named movie remains the subject of short follow-ups such as `How long is it?` and `What is the story?` until a new movie is chosen or the conversation is reset.
- Exact and nearby-time results distinguish an exact match from the closest available options.
- Exact visible movie titles and showtimes are selected deterministically for typed and normalized voice turns.
- Unsupported venues are not silently fuzzy-matched to a different cinema. Verified nearby VOX alternatives are offered from known location mappings.
- Hatta is disclosed as having no listed VOX cinema and presents curated Fujairah, Al Zahia, and Ajman alternatives. The retained notice updates when the interface language changes.
- Zero-result language, genre, cinema, and date combinations return an honest no-result state instead of fabricated availability.
- Afghan-origin, Dari-language, and Pashto-language requests are separated by a required three-way clarification when the guest says only `Afghan`.
- Generic preference phrases such as `anything is fine` remain non-selecting.
- Explicit filter changes such as `any language is fine` and `no genre preference` are routed to discovery instead of being mistaken for movie-detail questions.
- Experience modifiers such as `Show me IMAX instead` update the retained experience and are not parsed as movie title `instead`.
- One selected seat equals one ticket. Seat changes recalculate ticket count, subtotal, fees, and total.
- There is no separate quantity step or plus and minus quantity control.
- The guest can return from checkout to the seat map, change seats, and continue with the updated order.
- An unsolicited `select_seats` tool call is rejected unless it matches the guest-authorized seat selection for the current session and stage.
- FAQ and offer detours can hide the active rich panel and then restore the exact showtime, seat, checkout, history, or cancellation stage.
- Cancellation requests display active device-local bookings. Selecting a listed booking by movie title continues cancellation instead of starting movie discovery.
- Payment preview creates a clearly disclosed device-only summary and reference QR. It does not claim a charge, reservation, or admission ticket.
- The bank-offer panel supports summaries, exact cards, experiences, limits, redemption, exclusions, terms, and official source links.
- Compact posters and offer images remain inside the protected 420 px white and blue widget layout.
- Static and runtime validation reject Unicode em dash and en dash characters in customer-facing content.

## Partially working

- Voice transport configuration, transcript routing, explicit language override, context restoration, and bounded error recovery are implemented and tested. Real recognition accuracy, audible English output, and audible Arabic output are not proven by automated testing.
- Journey context survives supported detours and transport changes in the current page session. An unfinished journey is not a cross-device server record.
- Schedule freshness depends on the daily refresh workflow, validation, and successful deployment of the promoted snapshot.
- Nearby cinema suggestions use repository location knowledge. They are not calculated from live device geolocation or travel time.
- Public bank-offer pages do not always publish complete card and eligibility terms. The widget preserves those source limitations and directs the guest to final checkout verification.

## Blocked or not implemented

- Live seat inventory and seat holds.
- Authoritative fees and transaction pricing.
- Payment authorization or capture.
- Applied bank-offer redemption.
- Provider-confirmed booking creation.
- Official ticket and admission QR issuance.
- Provider cancellation, refund eligibility, refund processing, and refund references.
- Cross-device booking lookup or account-linked booking history.
- Live customer-care transfer to Genesys or OneView.
- Automated acoustic acceptance without an available microphone and audible output device.

## ElevenLabs status and required actions

Target agent: `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`

Published contract: `2026-07-22.2`

Prompt SHA-256: `8d6747a745286f6b3e8b6acef83762f267eab0649cbb8504b6dc1d9f5d8ae0b8`

Verified published settings:

- Agent name `VOXi - VOX Cinemas UAE`.
- First message exactly `{{voxi_session_opening}}`.
- English default voice Eric.
- Arabic voice Abdullah.
- Gemini 2.5 Flash.
- English and Arabic configured.
- Automatic language detection disabled.
- Explicit agent-language override retained.
- WebRTC voice and WebSocket text transport.
- `serverLocation: "eu-residency"`.
- Exact client-tool names, including protected `select_seats`.
- Wait-for-response behavior on all client tools.

No further dashboard prompt edit is required for contract `2026-07-22.2`. Live English and Arabic voice transport is verified. Remaining acceptance is limited to speaking and listening in each language to judge recognition and audible output quality. Do not rename client tools, change EU residency, remove `select_seats`, or replace the existing fuzzy movie and session resolvers.

## API and knowledge needs

Production transactions require:

- A licensed VOX film, session, live-seat, and seat-hold gateway.
- An authoritative quote, fee, tax, and offer-application service.
- Secure payment authorization and provider booking confirmation.
- Official ticket and QR issuance.
- Account or reference-based booking lookup.
- Provider cancellation and refund APIs.
- A confirmed Genesys or OneView handover connector if live transfer is required.

Sustained content accuracy requires:

- A VOX-owned structured showtime feed, or monitored continuation of the current daily public-source refresh.
- A structured bank-offer or CMS feed with promotion IDs, exact card tiers, limits, locations, experiences, expiry, exclusions, and terms URLs.
- Content ownership and alerts for expired, blank, changed, or conflicting source pages.
- Optional geocoding and travel-time services if truly nearest suggestions are required.

## Evidence and release validation

The final release completed:

- Full `pnpm run validate` aggregate across 50 validation commands.
- `pnpm run build` and the cold-load budget.
- Final initial JavaScript at 887,453 raw bytes, 249,419 gzip bytes, and 226,901 Brotli bytes against the 230,400-byte Brotli limit.
- Cloudflare bundle and snapshot parity at code commit `0030943cb5cb3290f85a044c9d2677b54bad4e21`.
- English specific-movie filtering for Supergirl at Mall of the Emirates.
- Exact showtime selection using `9` for the visible 09:30 session.
- Manual seat change from E1 and E2 to E1 and E3, with two tickets and AED 84 at checkout.
- FAB FAQ detour and exact checkout restoration.
- Samsung Pay device-only preview, disclosure, saved reference, and reference QR rendering.
- Booking cancellation by movie title and explicit device-only cancellation disclosure.
- Arabic movie-language filtering without interface switching.
- Explicit Arabic interface and transport switching with retained journey state.
- Arabic family discovery at Mall of the Emirates.
- Dubai Mall rejection with verified VOX alternatives.
- Combined Mall of the Emirates, tomorrow, and 6 PM filtering, including the exact 18:00 option.
- French-language zero-result handling.
- Explicit French-filter removal followed by an open-choice request, without treating either phrase as a movie title.
- Ezma PG15 suitability for a 10-year-old, followed by grounded runtime, synopsis, and language questions using retained movie context.
- Hatta no-cinema disclosure, three curated alternatives, and immediate English-to-Arabic notice localization.
- Bank-offer rendering with 21 promotions and 20 offer groups.
- Compact poster rendering and empty browser error and warning logs during the critical replay.

The hosted replay exposed three issues that were then corrected in source:

1. The model could shorten the required Afghan-origin, Dari-language, or Pashto-language clarification. An authoritative response override now preserves the exact three-way question.
2. The agent could call `select_seats` immediately after the seat map opened. A short-lived, exact-session authorization now permits the tool only after the guest chooses or confirms seats.
3. The word `instead` could be treated as a movie title in `Show me IMAX instead`. Generic residual filtering now keeps the intended experience change.

After these corrections, the complete `pnpm run validate` aggregate passed. `pnpm run build` also passed and produced `/assets/index-CSjTLhgw.js` at 226,901 of 230,400 initial JavaScript Brotli bytes. The mounted-browser replay passed movie-information continuity, filter recovery, Hatta alternatives, localized retained notices, the prior clarification and seat protections, and the 420 px visual inspection.

The final Cloudflare replay passed Ezma selection and current showtimes, PG15 guidance, seat-derived count and pricing, checkout-to-seat editing, AED 42 repricing, device-only summary and QR, cancellation by Ezma title, 21 bank promotions and FAB detail, family filtering, exact and nearby-time filtering, French filter recovery, Arabic movie filtering without an interface switch, explicit Arabic interface and transport switching, Hatta alternatives, and live English-to-Arabic WebRTC restart. The 420 px layout remained visually contained.

The first Supergirl cards appeared within 1.733 seconds, including a 1.4-second observation wait. A fresh final tab had no browser errors or warnings. The longer replay produced only the expected WebSocket-close warning during an intentional language restart, with no browser error logs.

Repository evidence:

- [Final 22 July validation report](./FINAL_VALIDATION_REPORT_2026-07-22.md)
- [Generated snapshot manifest](./src/generated/voxSnapshotManifest.js)
- [ElevenLabs versioned contract](./config/elevenlabs-agent-contract.json)
- [ElevenLabs setup and acceptance checklist](./ELEVENLABS_AGENT_SETUP.md)
- [21 July Arabic checkout continuity](./evidence/screenshots/cloudflare-arabic-checkout-restored-2026-07-21.jpg)
- [21 July local Arabic checkout](./evidence/screenshots/local-final-arabic-checkout-2026-07-21.jpg)
- [Final Cloudflare Arabic location rendering](./evidence/screenshots/final-cloudflare-arabic-location-2026-07-22.png)
- [Bank-offer and ElevenLabs validation log](./evidence/logs/bank-offers-elevenlabs-validation-2026-07-17.md)

## Final production-readiness status

Leadership review status: **READY WITH DISCLOSED BOUNDARIES.**

Repository feature readiness: **PASS LOCALLY AND ON THE FINAL CLOUDFLARE RELEASE.**

Voice transport readiness: **PASS IN ENGLISH AND ARABIC ON CLOUDFLARE.**

Acoustic recognition and audible output quality: **PENDING A HUMAN SPEAK-AND-LISTEN ACCEPTANCE TEST.**

Live ticket-sale readiness: **BLOCKED BY EXTERNAL PROVIDER APIS.**

The widget truthfully labels preview, device-local booking, QR, cancellation, offer, and handover boundaries. Those disclosures must remain until the corresponding licensed integrations are enabled and validated.
