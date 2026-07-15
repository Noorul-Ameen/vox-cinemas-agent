# VOXi production-readiness report

Report date: 15 July 2026 (Asia/Dubai)

Repository: `Noorul-Ameen/vox-cinemas-agent`

Cloudflare URL: <https://voxi-ai.pages.dev/>

StackBlitz URL: <https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

## Executive decision

**Leadership journey review: READY on the tested local build and matching Cloudflare deployment for schedule discovery, voice startup, seat selection, checkout preview, local booking/QR presentation and local cancellation.**

**Customer production sales: NO-GO until licensed transactional APIs are enabled.**

The current revision uses a fresh official VOX UAE public-site extraction, a white-and-blue interface, and a CSP-compatible ElevenLabs voice-startup fix. Local acceptance passed FAQ return and the full booking journey. Hosted acceptance passed English/Arabic discovery, Back/Forward, seat-derived checkout, QR confirmation, local-only cancellation, compact media and RTL rendering at 420 px. Hosted signed-in Chrome voice startup also passed without console warnings or errors. The Cloudflare JavaScript is byte-identical to the tested local bundle.

The latest Actions refresh completed at `2026-07-15T07:21:28.186Z`, committed the generated data as `1cf0d56`, and left 9,460 validated sessions, 35 films and 22 cinemas across 16–22 July 2026. Daily and Thursday schedules are enabled.

Revision evidence on `main` includes application commit `4605dc4`, workflow commit `5a50d39`, voice-CSP fix `46648b5`, workflow Actions-runtime update `5e73c1d`, the first refresh result `76496b7`, and the latest validated refresh `1cf0d56`.

The journey must not be presented as creating a live VOX sale. Reservations, inventory holds, authoritative prices, payments, official tickets, cross-device booking lookup, refunds and offer redemption remain unavailable until licensed server APIs and security controls are provided.

## Protected integration contract

The following constraints remain unchanged:

- ElevenLabs voice uses WebRTC with `serverLocation: "eu-residency"`.
- The original client-tool names remain `show_movie_selection`, `show_showtimes`, `show_seat_map`, `select_seats`, `show_booking_summary`, and `show_booking_for_cancellation`.
- `show_seat_map` remains non-blocking and `select_seats` retains its protected contract.
- Fuzzy movie and session resolvers remain in place.
- The 420 px mobile layout remains supported.
- No ElevenLabs key, rotating VOX public-site token, Vista credential, payment secret or other real secret is stored in the repository or a `VITE_*` value.

## Current official schedule bridge

The successful refresh produced:

| Measure | Result |
| --- | ---: |
| Extracted at | `2026-07-15T07:21:28.186Z` |
| Programming dates | 16–22 July 2026 |
| Raw session rows | 9,499 |
| Current validated sessions | 9,460 |
| Duplicate source rows removed | 39 |
| Sessions on 16 July | 1,438 |
| Scheduled films | 35 |
| Cinemas | 22 |
| Experience-media records | 14 |
| Offer-media records | 20 |

`npm run refresh:data` performs extraction into staging files, validates freshness, date coverage, completeness, reconciliation, source identity and media provenance, converts the client dataset, imports the generated module, and runs repository validation plus the production build. Promotion happens only after every gate succeeds; a failure restores the previous known-good JSON/module pair.

`.github/workflows/refresh-vox-showtimes.yml` is scheduled daily at 01:30 UTC (05:30 UAE), with an additional Thursday run at 06:30 UTC (10:30 UAE) and manual dispatch. It commits only changed schedule JSON and generated client data. [Actions run 29397059917](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/29397059917) passed the updated `checkout@v7`, `setup-node@v7` and `setup-python@v6` extraction, all 24 validators, production build, commit and push, producing refresh commit `1cf0d56`. The earlier [run 29396366283](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/29396366283) also completed end to end. If official VOX routes reject GitHub datacenter traffic, repository variable `VOX_REFRESH_RUNNER` can point to an approved self-hosted runner on a permitted normal network.

This bridge reflects published public-site programming; it is not a licensed real-time inventory or reservation API. The official route contract can change without notice, so alerting and a named data owner are required.

## What works

- Progressive discovery retains supplied cinema/location, date, preferred time, genre, language, experience, specific title and family/kids intent, then asks only for missing information.
- Results apply all available criteria. Exact-time filtering and explicit nearest-time fallback work, including combined cinema/date/time queries and specific-title requests such as Moana.
- A generic “What is playing…” request now enters movie discovery correctly instead of falling through to unrelated conversation handling.
- Deterministic widget results are sent back as authoritative agent context, reducing contradictions between the assistant sentence and displayed movie/showtime cards.
- Ticket count, subtotal, fees and checkout total derive only from selected seats. A stated ticket quantity is guidance for the number of seats, not a separate quantity stage.
- Checkout can return to the editable seat map. Changing an upstream cinema, date, movie or showtime clears incompatible seats and quote state.
- FAQ interruption returns to the active booking stage without leaving stale interactive components in the transcript.
- Local and hosted booking presentation renders a compact poster, booking details and a clearly bounded device-local reference QR. Hosted lookup and two-step cancellation update the stored local-only status and clean up the QR/action state.
- Typed interaction starts without microphone access. Text and voice transcripts share the same intent router.
- Explicit English/Arabic selection, Arabic RTL presentation, LTR booking identifiers and the 420 px layout are preserved.
- Official posters, experience art and live offer imagery render with compact cards and resilient fallbacks.
- The white-and-blue theme follows only the colour direction of the VOX Kuwait reference while the product, data and behavior remain VOX Cinemas UAE.
- The repository retains a restrictive CSP. `script-src` permits the minimum `blob:` source required by ElevenLabs React 0.7.1's secondary WebRTC output-capture worklet while continuing to block `data:` scripts.

## Voice fix and current status

The hosted failure was traced to Content Security Policy, not the public agent ID or microphone choice. The primary ElevenLabs AudioWorklets are now self-hosted and passed through `workletPaths`. Further hosted tracing showed that ElevenLabs React 0.7.1 creates a secondary WebRTC output-capture worklet that ignores those paths and still uses a `blob:` URL.

The client self-hosts the primary worklets under `public/elevenlabs/`, passes their paths only when starting voice, and permits `blob:`—but not `data:`—for the SDK's secondary worklet. Microphone permission and voice-transport startup each have a 45-second bound. Failures are classified into permission, device, browser component, service, timeout and generic cases with English and Arabic messages.

The protected WebRTC transport, EU residency, public agent identifier flow and client-tool names were not changed. Repository validation covers the worklet files, paths, scoped CSP allowance, timeouts, error classification and bilingual string parity.

**Hosted acceptance passed in signed-in Chrome:** the interface entered `Voice chat`, received the agent greeting, showed `End voice`, and logged zero console warnings or errors. Broader Arabic voice and physical mobile-browser acceptance remain customer-launch gates.

## What is partially working

- **Showtimes:** current published schedules are available and two manual GitHub refreshes, including the updated Actions-runtime path, passed end to end. The next naturally scheduled run and its operational alert path still need observation. Public-site routes are a temporary bridge, not a service-level agreement.
- **Voice:** local contract validation and hosted signed-in Chrome startup passed. Arabic spoken acceptance, mobile devices and a broader browser/device matrix remain pending.
- **Seats and pricing:** selection, derived count and preview quote behavior work locally. Authoritative seat holds, concurrent conflict handling, official fees and expiry require server APIs.
- **Checkout and booking:** the local and hosted end-to-end presentation works, but it creates only a device-local reference.
- **Cancellation:** a stored local-only booking can be found and marked cancelled on the hosted app. No remote booking ownership check, cancellation write or refund is performed.
- **QR:** the rendered QR contains a local reference and is not a cinema-entry ticket or wallet pass.
- **Offers:** current media and structured guidance display, but bank validation and redemption are not connected.
- **Customer Care:** a redacted transfer summary can be prepared, but no Genesys/OneView connection is made.
- **FAQ:** bilingual deterministic answers exist; production publication approval, freshness ownership and knowledge synchronization are still required.
- **Navigation:** in-widget Back, FAQ return and hosted browser Back/Forward passed. A full document exit/reload does not preserve every in-memory booking step without an approved persistence design.
- **Accessibility and device coverage:** local and hosted 420 px English/Arabic inspection passed without document-level horizontal overflow. Physical device, screen-reader, keyboard-only and design sign-off remain open.

## What does not work as a live operation

- Authoritative seat reservation or inventory lock.
- Server-authoritative prices, taxes, fees, discounts or quote expiry.
- PCI-compliant card/wallet authorization, capture, reversal, 3DS or reconciliation.
- Creation or delivery of an official booking, cinema-entry QR or wallet ticket.
- Authenticated cross-device booking history.
- Server-side cancellation, refund initiation or refund tracking.
- Offer application/redemption or bank-side eligibility validation.
- Transactional food-and-beverage ordering.
- Live Genesys transfer or OneView write.
- Guaranteed schedules if the public-site extraction contract changes or every approved refresh runner is unavailable.

## Blocked items

| Blocker | Owner/dependency | Impact |
| --- | --- | --- |
| Arabic spoken and mobile-browser acceptance are pending | QA/device lab and ElevenLabs agent owner | Hosted desktop English voice passed, but the full device matrix is not release-qualified |
| Licensed transaction and customer API contracts are unavailable | VOX platform/API owners | No live reservation, payment, official ticket, cancellation or refund |
| Production FAQ/policy approval and freshness ownership are unassigned | CX/content/legal owners | Customer answers cannot yet be treated as approved policy |
| Physical-device accessibility and performance sign-off is incomplete | QA/design/performance owners | Customer launch sign-off remains open |

## Required ElevenLabs changes and checks

For agent `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`:

1. Keep WebRTC, `serverLocation: "eu-residency"`, `select_seats` and every protected original tool name unchanged.
2. Confirm all eight client tools use schemas matching the web client. `show_offers` and `handover_to_agent` must be present in addition to the original six.
3. Apply the progressive-discovery rules from `ELEVENLABS_AGENT_SETUP.md`: extract supplied criteria, ask only for missing information, retain preferences and clearly label nearest-time results.
4. Remove any separate ticket-quantity instruction. Selected seats are the only count/pricing source; a quantity utterance is only a selection target.
5. Treat the deterministic widget result/context update as authoritative for availability and selected booking details.
6. Configure the first message as `{{voxi_session_opening}}` and retain the documented continuation variables.
7. Require explicit confirmation before switching English/Arabic; do not switch on language detection alone.
8. Allow only approved local QA, StackBlitz and final Cloudflare origins for the public agent.
9. Preserve the prohibition on PAN, expiry, CVV, OTP, PIN and passwords in voice or text.
10. Retain the passed hosted English Chrome smoke test and complete Arabic voice plus the broader mobile/browser matrix, covering reconnect, text-to-voice continuation, discovery filters, FAQ interruption, seat selection and checkout return.

No ElevenLabs dashboard change is needed for CSP. The application self-hosts the primary worklets and scopes the required `blob:` allowance to scripts; `data:` remains blocked.

## Required API and knowledge-base changes

### Transaction and customer services

- Authenticated schedule and inventory gateway with UAE programming-day semantics, status, language, experience and freshness metadata.
- Seat map and hold service with accessibility metadata, conflict handling, expiry, release and idempotency.
- Authoritative quote service tied to the seat hold.
- PCI-compliant hosted payment with 3DS, webhooks, reconciliation and safe retries.
- Idempotent booking creation and official ticket/QR delivery.
- Authenticated booking lookup across devices and approved account/loyalty data.
- Cancellation/refund eligibility, execution, reference, status and audit trail.
- Offer terms, eligibility, application and redemption confirmation.
- Optional venue/session F&B menu, basket and fulfillment APIs.
- Genesys/OneView connector with consent, transfer state and correlation ID.
- Privacy-safe telemetry across client, ElevenLabs and server services without unapproved transcript or payment logging.

### Knowledge and data governance

- Move approved policy/editorial answers to a versioned CMS or ElevenLabs knowledge base; keep showtimes, inventory, prices, offers, bookings and balances API-driven.
- Require stable article ID, English/Arabic content, source URL, owner, reviewer, approval date and review/expiry cadence.
- Separate customer content from internal SOP and escalation guidance.
- Add validated delta sync, link checks, locale parity, rollback and named owners for fast-changing refund, accessibility, age, hours, campaign and contact content.
- Assign an owner for the temporary public-site schedule bridge, refresh alerts, route-change response and transition to the licensed API.

## Local and hosted test results

### Family-to-action transcript regression (15 July 2026)

| Check | Result | Evidence/notes |
| --- | --- | --- |
| Local and hosted 420 px text replay | Pass | Mall of the Emirates and 17 July 2026 were retained from the opening request. After the customer changed from family/educational guidance to action, the earlier audience preference no longer remained as an incompatible filter. Both builds returned exactly **Supergirl**, **Moana**, **Sakr w Canaria**, and **Shamshoun w Dalila**. The hosted replay used `https://voxi-ai.pages.dev/` after Cloudflare served asset `index-DHbvOPpn.js`; no browser warnings or errors were recorded. |
| Ambiguous “The chosen movies.” reply | Pass | In both local and hosted replays, no movie was auto-selected. The four cards remained visible and Voxi asked the customer to name the exact title; it did not say “Great choice” or advance to showtimes. |
| Post-change voice parity | Pending spoken replay | Text and voice use the same deterministic preference, result-grounding, and selection-guard handlers, and the shared routing regressions pass. An actual spoken WebRTC replay of this exact family-to-action sequence has not yet been completed after the change, so this is not recorded as a post-change voice end-to-end pass. |

| Scenario | Result | Evidence/notes |
| --- | --- | --- |
| Current schedule validation | Pass | 9,460 sessions, 35 films, 22 cinemas and seven dates from 16–22 July; 1,438 sessions on 16 July |
| Generic “What is playing…” discovery | Pass | Parser routing fix retested |
| Combined cinema/date/time request | Pass | Existing criteria retained; results narrowed |
| Exact and nearest-time handling | Pass | Nearest options explicitly identified when exact time absent |
| Specific Moana request | Pass | Relevant title/cinema/showtimes only |
| Seat-derived count and pricing | Pass | Add/remove seat updates count, subtotal, fees and total |
| Checkout Back to seat map | Pass | Seat map restored and editable |
| FAQ interruption and return | Pass | Active booking context restored |
| Booking confirmation and QR | Pass | Local-reference boundary shown |
| Current-booking cancellation | Pass | Stored status updated and rendering cleaned up |
| Arabic/RTL flow | Pass | 420 px visual pass |
| Hosted Arabic family/near-time query | Pass | RTL results filtered to the supplied family/time criteria without overflow |
| Hosted Arabic booking | Pass | Toy Story 5 17:45 KIDS; A1/A2/A4 produced 3 tickets and AED 126 |
| Hosted checkout Back | Pass | All three seats remained selected and editable; checkout then accepted the masked demo card |
| Hosted booking confirmation | Pass | QR/reference `WLZWP6P` rendered and the seat map was removed |
| Hosted local-only cancellation | Pass | Two-step confirmation changed the card to cancelled and removed QR/action controls |
| Hosted Back/Forward | Pass | Navigation returned successfully without rendering overflow |
| Hosted browser console | Pass | Zero warnings or errors during voice, query, booking and cancellation acceptance |
| Poster, experience and offer media | Pass | Compact cards/fallback behavior verified |
| White/blue theme at 420 px | Pass | No document-level horizontal overflow in inspected states |
| Voice source/CSP contract | Pass | Self-hosted primary worklets, required `blob:`/blocked `data:`, paths, timeouts and bilingual errors validated |
| Hosted Chrome voice | Pass | `Voice chat`, greeting and `End voice`; zero console warnings/errors |
| Hosted exact cinema/date/time query | Pass | Mall of the Emirates tomorrow 18:00 returned Toy Story 5 at 17:45 KIDS, The Odyssey at 18:00/18:15 and Match at 18:10 |
| Hosted poster containment | Pass | Cards measured 104 × 156 px and remained contained |
| Full validation and build | Pass | `pnpm run validate` passed all 24 validators; `pnpm run build` produced a 4,541,586-byte bundle |
| Cloudflare artifact parity | Pass | `/assets/index-D4Y0PLpS.js` is byte-identical to local SHA-256 `D704F5665F3792FE525BFC8DD6E69D84EE7A7E396A3C45D7F6391B106307C6AB` |
| Hosted root and worklet delivery | Pass | Root document and both worklet URLs returned HTTP 200 |
| Manual GitHub refresh | Pass | Run 29396366283 completed and committed refreshed data |
| Updated Actions runtime follow-up | Pass | Run 29397059917 passed on v7/v7/v6 and committed `1cf0d56` |

## Screenshot and log evidence

| Evidence file | Content |
| --- | --- |
| `evidence/logs/hosted-acceptance-2026-07-15.md` | Cloudflare artifact, voice, text, poster and GitHub refresh acceptance facts |
| `evidence/logs/showtime-voice-theme-local-acceptance.md` | Historical pre-deployment refresh facts, local scenario matrix and voice root cause/fix |
| `evidence/logs/local-browser-e2e.md` | Earlier detailed local journey and hosted-baseline observations |
| `evidence/logs/pnpm-run-validate.txt` | Repository validation command output from the preceding tested revision; retain as historical command evidence until refreshed for this revision |
| `evidence/logs/pnpm-run-build.txt` | Production build output from the preceding tested revision; retain as historical command evidence until refreshed for this revision |
| `evidence/screenshots/local-white-blue-july16-420.png` | White/blue current-date result at 420 px |
| `evidence/screenshots/local-generic-filtered-july16-420.png` | Generic discovery routing and filtered July 16 results |
| `evidence/screenshots/local-arabic-white-blue-july16-420.png` | Arabic/RTL white-and-blue state at 420 px |
| `evidence/screenshots/local-booking-qr-white-blue-420.png` | Booking confirmation and local reference QR in the new theme |
| `evidence/screenshots/local-checkout-seat-derived-420.png` | Seat-derived checkout count and pricing |
| `evidence/screenshots/local-cancellation-confirmed-420.png` | Local cancellation confirmation and cleanup |
| `evidence/screenshots/hosted-white-blue-july16-420.png` | Hosted English exact cinema/date/time results and compact posters at 420 px |
| `evidence/screenshots/hosted-arabic-family-july16-420.png` | Hosted Arabic/RTL family and near-time filtering at 420 px |
| `evidence/screenshots/hosted-booking-qr-arabic-420.png` | Hosted Arabic confirmation with QR/reference and cleaned seat-map state |
| `evidence/screenshots/hosted-cancelled-booking-arabic-420.png` | Hosted Arabic local cancellation state with QR/action cleanup |
| `evidence/screenshots/hosted-old-date-misroute-420.png` | Historical hosted failure baseline retained for regression context |

## Release gates

Leadership review of the current schedule/display/checkout-preview journey can proceed on Cloudflare. The deployed JavaScript is byte-identical to the locally accepted bundle. Hosted voice startup, English exact-time discovery, Arabic/RTL family filtering, seat-derived checkout, Back/Forward, QR confirmation and local-only cancellation all passed without console warnings/errors or document-level overflow. External-service and device-specific behavior still requires its own production matrix.

A customer production launch additionally requires:

1. A clean install, complete validation and production build for the final revision with archived logs.
2. Exact tested-revision deployment to Cloudflare with asset identity and security headers recorded. **Passed for `/assets/index-D4Y0PLpS.js`.**
3. Successful manual and scheduled refresh runs with alerting, ownership and rollback evidence. **Two manual end-to-end runs, including the updated Actions runtime, passed; first natural schedule observation remains.**
4. Hosted English/Arabic text acceptance and human voice acceptance on approved desktop and mobile browsers. **English and Arabic text passed; English desktop Chrome voice passed; Arabic voice/mobile matrix remains.**
5. Licensed inventory, hold, quote, payment, booking, official ticket and cancellation/refund services.
6. Security, privacy, PCI, accessibility, performance and data-licensing approval.
7. Approved bilingual knowledge and offer content with operational freshness controls.
8. Monitoring, incident ownership, support handover and rollback readiness.

Until customer transaction services and these launch gates are complete, production sales remain **NO-GO**.
