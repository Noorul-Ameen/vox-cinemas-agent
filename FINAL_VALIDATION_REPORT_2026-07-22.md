# VOXi final validation report

Date: 22 July 2026, UAE

Public URL: <https://voxi-ai.pages.dev/>

Repository: <https://github.com/Noorul-Ameen/vox-cinemas-agent>

StackBlitz: <https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

Production branch: `main`

Validated hosted code release: commit `0030943cb5cb3290f85a044c9d2677b54bad4e21`, bundle `/assets/index-CSjTLhgw.js`

Final corrective deployment: PASS

## Executive decision

The 22 July corrective release is deployed and passes the critical hosted text, rendering, booking, cancellation, language, availability, offer, voice-transport, and layout journeys described below. In addition to the earlier journey protections, this release grounds movie ratings and details, retains the named movie across short follow-ups, separates movie filters from movie-detail questions, routes Hatta to curated alternatives, and localizes retained location notices after a language switch.

Those corrections passed the complete aggregate validator, production build, local mounted replay, GitHub push, Cloudflare asset-parity check, and final hosted replay. Code commit `0030943cb5cb3290f85a044c9d2677b54bad4e21` and `/assets/index-CSjTLhgw.js` were verified on the production domain.

The user-facing web experience is ready for leadership review with the disclosed boundaries. It is not ready for live ticket sales because licensed inventory, hold, payment, ticket, provider cancellation, and refund APIs are not connected. Voice transport connected in English and Arabic on Cloudflare, including an English-to-Arabic restart. Acoustic recognition and audible TTS quality still require a human speak-and-listen acceptance check.

## Status summary

| Area | Status | Result |
| --- | --- | --- |
| Progressive discovery | PASS | The widget retains cinema, city, date, time, genre, language, experience, movie, and audience criteria, asks only for missing information, and avoids large unfiltered lists. |
| Availability grounding | PASS | Results are derived from the promoted VOX UAE snapshot. Unsupported venue and no-result cases are disclosed without fabricated movies or cinemas. |
| Movie and showtime selection | PASS | Exact visible titles and exact visible times route deterministically for typed and normalized voice turns. Ambiguous and information-only turns remain non-selecting. |
| Seat and checkout journey | PASS LOCALLY AND ON CLOUDFLARE | Ticket count and price come only from selected seats. Checkout can return to seats and restore. The seat map remained at zero selected seats until the guest typed E1 and E3, then checkout showed two seats and AED 84. |
| Cancellation | PASS | Selecting a listed booking by its movie title remains in the cancellation journey and requires confirmation. The result is disclosed as device-only. |
| FAQ and offer continuity | PASS | FAQ and offer detours preserve and restore the active showtime, seat, checkout, booking-history, or cancellation stage. |
| English and Arabic text | PASS | Explicit interface selection controls the active agent language. Arabic-language movie requests do not silently switch the interface. |
| Voice application path | PASS LOCALLY AND ON CLOUDFLARE | WebRTC, explicit language override, shared routing, transcript handling, recovery, permission errors, live English start, live Arabic restart, and clean stop are validated. |
| Acoustic voice quality | MANUAL ACCEPTANCE REQUIRED | Automated testing did not speak a controlled utterance or judge audible English and Arabic TTS. |
| ElevenLabs dashboard | PASS | Contract `2026-07-22.2` is published and read back from the target agent. |
| Schedule snapshot | PASS | 11,716 sessions, 45 films, 22 cinemas, and 22 dates from 2026-07-22 through 2026-08-12. |
| Bank offers | PASS WITH SOURCE LIMITATIONS | 21 promotions across 20 offer groups are available with bilingual detail and official links. Missing official conditions remain explicitly unknown. |
| 420 px visual layout | PASS ON VERIFIED BASELINE | White and blue layout, compact posters, offer artwork, RTL treatment, seat map, checkout, and QR remained inside the widget in the tested browser. |
| Customer-facing punctuation | PASS | Repository and runtime validation reject Unicode em dash and en dash characters. The focused repository scan also passed after this report was added. |
| Corrective Cloudflare build | PASS | Code commit `0030943cb5cb3290f85a044c9d2677b54bad4e21`, asset `/assets/index-CSjTLhgw.js`, and the critical hosted replay were verified. |
| Live ticket transactions | BLOCKED | Licensed provider APIs are required. |

## Fresh schedule snapshot

Validated snapshot: `20260722-9494582985db4292`

Extraction time: `2026-07-22T04:45:48.076Z`

- 11,793 source rows.
- 11,716 deduplicated sessions.
- 77 duplicate rows removed.
- 45 scheduled films.
- 22 VOX UAE cinemas.
- 22 programming dates from 2026-07-22 through 2026-08-12.
- 1,368 sessions on 22 July.
- 1,376 sessions on 23 July.
- 320 runtime cinema and date shards.
- 4,171,104 total shard bytes.
- No missing official movie posters in the promoted snapshot.
- 14 experience-media records, including retained first-party records where the latest upstream response was partial.
- 21 fresh offer-media records.

The daily refresh workflow validates freshness, coverage, deduplication, official IDs, media provenance, generated imports, the repository suite, and production build before promoting data. A Thursday supplementary refresh is also configured. Snapshot mode does not expose live sold-out state or current seat inventory.

## What works

### Discovery and rendering

- Text chat starts immediately without depending on microphone access.
- A guest can provide several requirements in one sentence. The supplied cinema, date, time, genre, language, experience, movie, and audience criteria are retained.
- A cinema, date, or time already provided is not requested again in the tested routes.
- A specific movie request returns that movie's relevant cinemas and showtimes rather than unrelated movies.
- Movie age-rating questions use the current VOX listing and UAE certificate rules. The Ezma PG15 age-10 case explains the 15-or-older accompaniment rule and suitability discretion.
- Runtime, synopsis, language, genre, subtitle status, cast, trailer, release date, and review-score questions use catalog facts and explicitly decline to invent missing information.
- An explicitly named movie remains available for short follow-ups such as `How long is it?`, `What is the story?`, and `What language is it?` until the movie changes or the conversation resets.
- Requests around a preferred time show exact or nearby options and state when there is no exact match.
- Kids and family, genre, movie language, cinema experience, cinema, and combined filters use the available-session index.
- A preference change updates the results. A change that invalidates movie, session, or seat state clears the incompatible selection.
- `anything is fine` and similar generic responses do not become a movie-title lookup.
- `any language is fine`, `no genre preference`, and plural filter requests remain discovery turns rather than movie-detail questions.
- `Show me IMAX instead` and `Show me IMAX only` retain IMAX as the experience without treating the modifier as a title.
- `Afghan` alone requires clarification among Afghan-produced movies, Dari-language movies, and Pashto-language movies.
- Unsupported cinemas such as Dubai Mall are not silently mapped to another venue. The widget offers verified alternatives from known UAE mappings.
- Hatta is truthfully reported as having no listed VOX cinema, with curated Fujairah, Al Zahia, and Ajman alternatives. The notice changes immediately when the interface language changes.
- French or another unavailable movie-language request returns a no-result state and proposes changing a criterion.
- Posters render as compact cards inside the conversation instead of occupying the full widget.
- Data is loaded from versioned cinema and date shards. Movie rendering is not generated live by the language model.

### Booking, seats, and checkout

- One selected seat always equals one ticket.
- Adding or removing seats recalculates ticket count, subtotal, fees, and total.
- There is no independent ticket-quantity stage, plus control, or minus control.
- A conversational target such as three tickets guides the guest to select three seats.
- Returning from checkout to the seat map preserves the session, allows seat replacement, and produces a fresh quote.
- Changing movie, cinema, date, or showtime clears incompatible seats and pricing.
- `select_seats` is accepted only for the current session and stage when it matches a recent guest-authorized seat choice. Unsolicited or stale agent calls are rejected while the seat map remains visible.
- FAQ or offer questions at checkout can hide the checkout panel without destroying the order. A return request restores the exact movie, cinema, date, showtime, seats, count, and total after revalidation.
- The Samsung Pay action creates a preview summary only. Copy explicitly states that no payment or cinema reservation was submitted.
- The QR encodes the local reference only and is not described as an admission ticket.

### Booking history and cancellation

- Completed preview summaries persist in browser localStorage.
- Current-booking requests list device-local active summaries.
- A cancellation request opens the device-local booking list.
- Typing or saying a listed movie title selects that booking for cancellation instead of starting a new discovery journey.
- Confirmation updates the local record and states that no provider refund was issued.
- Cancellation detours do not destroy an unrelated paused booking journey.

### Language, FAQ, offers, and safety

- The English and Arabic selectors update the widget direction, labels, message copy, and ElevenLabs `overrides.agent.language` value.
- Typing Arabic does not by itself switch interface language. An Arabic-movie request remains a movie-language request.
- Explicit language switches retain the active journey.
- FAQ answers are resolved inline and do not create a second competing panel.
- The bank-offer catalogue contains 21 promotions across 20 offer groups with benefit, card, experience, limit, redemption, exclusions, terms, and official-source views.
- Offer copy does not claim that a discount has been applied. Final eligibility remains subject to VOX checkout.
- The widget never asks for card number, CVV, OTP, password, or banking credentials.
- Handover prepares a redacted payload but does not claim that a live agent was contacted.
- Customer-facing content is checked for prohibited Unicode dash characters in static and dynamic paths.

## What does not work as a live transaction

- Checkout does not reserve seats or charge a payment method.
- Seat availability, sold-out status, price, fees, tax, and offer application are not authoritative.
- The local reference QR is not an official VOX admission ticket.
- Cancellation does not call a provider, cancel a paid booking, or issue a refund.
- Booking history is not available across devices.
- Handover does not yet contact Genesys, OneView, or another care platform.

These limitations are intentionally disclosed in customer-facing copy and must remain until the corresponding production gateways are implemented.

## Partially working or environment-dependent

- The voice code path uses the real ElevenLabs SDK, WebRTC, EU residency, the selected agent language, shared journey state, and the same tool routing as text. A real microphone and speaker acceptance test remains outstanding.
- Browser permission denial, timeout, and unsupported-capture errors return bounded guidance and preserve text chat. This does not prove acoustic recognition quality.
- Active context is maintained through supported detours and transport restarts in the current page. It is not server-side conversational memory across devices.
- Schedule freshness is automated but still depends on the official public source remaining available and on each validated refresh deploying successfully.
- Nearby suggestions use curated area and city knowledge, not device GPS, route distance, or current travel time.
- A few bank promotions have incomplete official public terms. The widget reports the known information and directs the guest to checkout verification.

## Blocked

The following items are blocked by services or environments outside this repository:

- Licensed VOX film, showtime, seat-inventory, and seat-hold access.
- Authoritative quote, fee, tax, and offer-application services.
- Secure payment authorization and capture.
- Provider booking creation and official ticket issuance.
- Official admission QR generation.
- Account-based or reference-based cross-device booking lookup.
- Provider cancellation and refund operations.
- Live care handover connector.
- Automated real-microphone and audible-output verification in the current controlled browser.

## ElevenLabs published state

Target agent: `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`

Contract: `2026-07-22.2`

Prompt SHA-256: `8d6747a745286f6b3e8b6acef83762f267eab0649cbb8504b6dc1d9f5d8ae0b8`

The exact repository prompt was entered in the signed-in ElevenLabs dashboard, published, reloaded, and read back. The verification confirmed:

- First message `{{voxi_session_opening}}`.
- English default language and voice Eric.
- Arabic language and voice Abdullah.
- Gemini 2.5 Flash.
- Automatic language detection off.
- Explicit agent-language override behavior.
- Interruptible conversation.
- All eight exact client-tool names with wait-for-response enabled.
- WebRTC voice, WebSocket text, and EU residency.
- Scoped journey restoration, spoken discovery gating, and the Afghan clarification rule.

No additional ElevenLabs prompt change is required for this repository contract. The final Cloudflare replay established English and Arabic WebRTC sessions. The remaining acceptance action is to speak and listen in both languages to judge recognition and audible response quality.

Protected settings must remain unchanged:

- ElevenLabs WebRTC connection.
- `serverLocation: "eu-residency"`.
- Existing client-tool names.
- `select_seats`.
- Fuzzy movie and session resolvers.

## Required API and knowledge-base changes

For live transactions:

- Licensed schedule, seat, and hold gateway.
- Server-side price, fee, tax, and offer quote.
- Secure payment gateway and idempotent booking confirmation.
- Official ticket and QR service.
- Booking lookup API.
- Provider cancellation and refund API.
- Confirmed care-platform handover integration.

For content operations:

- Prefer a VOX-owned structured schedule feed over public-page extraction.
- Add deployment monitoring and alerting for daily snapshot refresh failures.
- Add a structured promotion feed with IDs, card tiers, locations, experiences, limits, expiry, exclusions, and canonical terms URLs.
- Assign content ownership for expired, blank, or conflicting offer pages.
- Add geocoding and route-distance services if live nearest-cinema ranking is required.

## Automated validation evidence

The final corrective release passed:

- `pnpm run validate`, covering 50 validator commands.
- `pnpm run build`.
- Snapshot extraction, integrity, shard, runtime, and cinema-date coverage checks.
- Discovery criteria, availability, prompt progression, annotated journey, exact movie, exact showtime, and programming-date checks.
- Seat-derived count, quote race, stale-stage, paused-stage, checkout continuity, booking, cancellation, and safety checks.
- Offers, FAQ, handover, i18n, language switching, conversation mode, transport, recovery, and voice-startup checks.
- ElevenLabs contract and protected-invariant checks.
- Customer-facing punctuation checks.
- Final cold-load budget at 887,453 raw bytes, 249,419 gzip bytes, and 226,901 Brotli bytes. The Brotli limit is 230,400 bytes.
- Final corrective production build `/assets/index-CSjTLhgw.js` at 226,901 Brotli bytes against the same 230,400-byte limit.

After hosted testing found movie-context, filter-routing, unsupported-location, and retained-notice localization defects, each exact reproduction received a deterministic regression check. The complete `pnpm run validate` aggregate and `pnpm run build` passed again after every correction. The final code commit was deployed and the Cloudflare replay passed.

## Local and hosted end-to-end evidence

The final corrective release was exercised on <https://voxi-ai.pages.dev/>.

Verified scenarios included:

1. `Show me Supergirl at Mall of the Emirates tomorrow` rendered only Supergirl with verified sessions.
2. Selecting Supergirl opened its showtimes, and typing `9` selected the visible 09:30 session.
3. Seats E1 and E2 were replaced with E1 and E3. Checkout showed two tickets and AED 84.
4. `What is the FAB offer?` displayed grounded FAB detail. Returning to checkout restored Supergirl, E1 and E3, and AED 84.
5. Samsung Pay produced a device-only preview with no-charge and no-reservation disclosure, a saved local reference, and QR rendering.
6. Cancellation listed the Supergirl summary. Entering `Supergirl` opened the cancellation confirmation rather than movie discovery, and confirmation marked the local record cancelled.
7. An English request for Arabic movies retained the English interface and returned only matching Arabic-language films.
8. The Arabic selector changed the interface and transport while retaining the journey. An Arabic family query returned verified family titles.
9. A Dubai Mall request stated that there is no VOX cinema there and suggested verified VOX alternatives.
10. A Mall of the Emirates request for tomorrow around 6 PM returned nearby relevant sessions and the exact 18:00 session where available.
11. A French-language request with no matching sessions returned an honest no-result response.
12. The offer panel rendered 21 promotions across 20 groups with expandable eligibility and source detail.
13. Compact movie posters rendered inside the card grid.
14. Text chat connected without microphone permission.

The preceding baseline replay exposed, rather than concealed, three defects:

1. The model paraphrased the three-way Afghan clarification too narrowly.
2. The agent selected E1 and E2 without a guest seat choice immediately after opening the seat map.
3. `Show me IMAX instead` tried to resolve `instead` as a movie title.

The repository source contains deterministic corrections and regression tests for all three. The local mounted replay passed the exact Afghan three-way clarification, IMAX refinement, no unsolicited seats, typed E1 and E3 selection through AED 84 checkout, French open-choice no-result retention, 420 px visual inspection, and browser back and forward reload.

The final hosted replay passed:

1. The exact three-way Afghan-produced, Dari-language, or Pashto-language clarification.
2. `Show me IMAX instead` as an experience refinement without a false movie-title error.
3. A zero-selection seat map until the guest typed E1 and E3, followed by two seats and AED 84 at checkout.
4. FAB FAQ detail and exact restoration of the same checkout.
5. Samsung Pay device-only summary, disclosure, local reference, and QR.
6. Cancellation selection by Supergirl title and confirmation with `yes`.
7. English voice transport connection and explicit Arabic voice-mode connection.
8. Arabic family filtering and Arabic-movie filtering while retaining the English interface.
9. Dubai Mall rejection with verified VOX alternatives.
10. Twenty-one bank promotions across 20 groups and detailed FAB information.
11. The protected 420 px visual layout.
12. Browser back and forward navigation returning to the same deployed asset.
13. Ezma PG15 suitability for a 10-year-old, followed by `How long is it?`, `What is the story?`, and `What language is it?` without losing the named movie.
14. Current Ezma showtimes stayed visible during a rating question.
15. Seats E2 and E3 produced two tickets and AED 84, then checkout editing removed E3 and recalculated one ticket at AED 42.
16. The saved Ezma summary rendered a reference QR, and `cancel Ezma` stayed in cancellation through explicit confirmation.
17. `any language is fine` cleared a retained French filter without becoming a movie-information question. A following `anything is fine` produced movie cards rather than a title error.
18. A Hatta request stated that no listed VOX cinema exists there and showed City Centre Fujairah, City Centre Al Zahia, and City Centre Ajman.
19. Switching the retained Hatta panel to Arabic localized its notice and preserved the three alternatives.
20. Live WebRTC reached English Voice chat, restarted into Arabic Voice chat, and stopped cleanly on Cloudflare.

The first Supergirl cards appeared within 1.733 seconds, including a 1.4-second observation wait. A fresh final tab recorded no browser errors or warnings. The earlier long-running replay recorded only the expected WebSocket-close warning during the intentional language restart, with no browser error logs.

Voice transport connection and language routing are verified in both languages. The automated replay did not speak a controlled utterance into the microphone or judge audible English or Arabic TTS, so no acoustic quality claim is made.

Existing visual and log evidence:

- [Final Cloudflare Arabic location rendering](./evidence/screenshots/final-cloudflare-arabic-location-2026-07-22.png)
- [Cloudflare Arabic checkout restored](./evidence/screenshots/cloudflare-arabic-checkout-restored-2026-07-21.jpg)
- [Local final Arabic checkout](./evidence/screenshots/local-final-arabic-checkout-2026-07-21.jpg)
- [Local Arabic checkout continuity](./evidence/screenshots/local-arabic-checkout-continuity-2026-07-21.png)
- [Local Al Quoz action routing](./evidence/screenshots/local-al-quoz-action-routing-2026-07-21.png)
- [Local seat-derived checkout](./evidence/screenshots/local-checkout-seat-derived-420.png)
- [Local booking QR](./evidence/screenshots/local-booking-qr-white-blue-420.png)
- [Local cancellation confirmation](./evidence/screenshots/local-cancellation-confirmed-420.png)
- [Bank-offer and ElevenLabs validation log](./evidence/logs/bank-offers-elevenlabs-validation-2026-07-17.md)
- [Mounted bank-offer browser results](./evidence/logs/bank-offers-mounted-browser-results-2026-07-17.json)
- [Generated snapshot manifest](./src/generated/voxSnapshotManifest.js)
- [ElevenLabs contract](./config/elevenlabs-agent-contract.json)
- [ElevenLabs setup and acceptance checklist](./ELEVENLABS_AGENT_SETUP.md)

## Final production-readiness status

Leadership web review: **READY WITH DISCLOSED BOUNDARIES.**

Final corrective web behavior: **PASS LOCALLY AND ON CLOUDFLARE.**

Voice transport: **PASS IN ENGLISH AND ARABIC ON CLOUDFLARE.**

Acoustic recognition and audible TTS quality: **PENDING A HUMAN SPEAK-AND-LISTEN ACCEPTANCE TEST.**

Live ticket sales: **BLOCKED BY LICENSED PROVIDER APIS.**

The final release record includes the validated code commit, promoted Cloudflare bundle, movie-information and filter regressions, booking and cancellation replay, bilingual WebRTC transport, localized location rendering, and the disclosed external boundaries. Acoustic quality acceptance remains the only browser-dependent voice item, and live ticket sales remain blocked by the licensed provider APIs listed above.
