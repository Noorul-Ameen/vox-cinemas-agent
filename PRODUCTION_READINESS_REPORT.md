# VOXi production-readiness report

Report date: 15 July 2026 (Asia/Dubai)

Repository: `Noorul-Ameen/vox-cinemas-agent`

Cloudflare URL: <https://voxi-ai.pages.dev/>

StackBlitz URL: <https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

## Executive decision

**Leadership journey review: READY locally for schedule discovery, seat selection, checkout preview, local booking/QR presentation and local cancellation.**

**Customer production sales: NO-GO until licensed transactional APIs are enabled.**

The current local revision uses a fresh official VOX UAE public-site extraction, a white-and-blue interface, and a CSP-compatible ElevenLabs voice-startup fix. Local browser acceptance passed the requested discovery, seat, checkout, FAQ, QR, cancellation, Arabic/RTL and media scenarios at 420 px. The deterministic parser for generic “What is playing…” requests and the authoritative agent-result context were also corrected and retested.

The schedule refresh completed at `2026-07-15T06:32:40.092Z` with 9,479 deduplicated sessions across 16–22 July 2026. A transactional daily refresh workflow is present, but its first GitHub-hosted run and this revision's Cloudflare deployment/hosted voice acceptance are not claimed in this pre-deployment report.

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
| Extracted at | `2026-07-15T06:32:40.092Z` |
| Programming dates | 16–22 July 2026 |
| Raw session rows | 9,518 |
| Deduplicated sessions | 9,479 |
| Duplicate source rows removed | 39 |
| Sessions on 16 July | 1,439 |
| Scheduled films | 35 |
| Cinemas | 22 |
| Session experience codes | 13 |
| Retrieved experience records | 14 |
| Live offer-media records | 20 |

`npm run refresh:data` performs extraction into staging files, validates freshness, date coverage, completeness, reconciliation, source identity and media provenance, converts the client dataset, imports the generated module, and runs repository validation plus the production build. Promotion happens only after every gate succeeds; a failure restores the previous known-good JSON/module pair.

`.github/workflows/refresh-vox-showtimes.yml` is scheduled daily at 01:30 UTC (05:30 UAE), with an additional Thursday run at 06:30 UTC (10:30 UAE) and manual dispatch. It commits only changed schedule JSON and generated client data. If official VOX routes reject GitHub datacenter traffic, repository variable `VOX_REFRESH_RUNNER` must point to an approved self-hosted runner on a permitted normal network.

This bridge reflects published public-site programming; it is not a licensed real-time inventory or reservation API. The official route contract can change without notice, so alerting and a named data owner are required.

## What works

- Progressive discovery retains supplied cinema/location, date, preferred time, genre, language, experience, specific title and family/kids intent, then asks only for missing information.
- Results apply all available criteria. Exact-time filtering and explicit nearest-time fallback work, including combined cinema/date/time queries and specific-title requests such as Moana.
- A generic “What is playing…” request now enters movie discovery correctly instead of falling through to unrelated conversation handling.
- Deterministic widget results are sent back as authoritative agent context, reducing contradictions between the assistant sentence and displayed movie/showtime cards.
- Ticket count, subtotal, fees and checkout total derive only from selected seats. A stated ticket quantity is guidance for the number of seats, not a separate quantity stage.
- Checkout can return to the editable seat map. Changing an upstream cinema, date, movie or showtime clears incompatible seats and quote state.
- FAQ interruption returns to the active booking stage without leaving stale interactive components in the transcript.
- Local booking confirmation renders a compact poster, booking details and a clearly bounded reference QR. Local booking lookup and cancellation update stored status.
- Typed interaction starts without microphone access. Text and voice transcripts share the same intent router.
- Explicit English/Arabic selection, Arabic RTL presentation, LTR booking identifiers and the 420 px layout are preserved.
- Official posters, experience art and live offer imagery render with compact cards and resilient fallbacks.
- The white-and-blue theme follows only the colour direction of the VOX Kuwait reference while the product, data and behavior remain VOX Cinemas UAE.
- The repository's strict CSP remains in place. No `blob:` or `data:` exception was added to `script-src`.

## Voice fix and current status

The hosted failure was traced to Content Security Policy, not the public agent ID or microphone choice: ElevenLabs React SDK 0.7.1 attempted to create AudioWorklets from generated `blob:`/`data:` sources while `script-src` correctly allowed only trusted self-hosted scripts.

The client now self-hosts both required worklets under `public/elevenlabs/` and passes their paths only when starting voice. Microphone permission and voice-transport startup each have a 45-second bound. Failures are classified into permission, device, browser component, service, timeout and generic cases with English and Arabic messages.

The protected WebRTC transport, EU residency, public agent identifier flow and client-tool names were not changed. Repository validation covers the worklet files, paths, strict CSP, timeouts, error classification and bilingual string parity.

**Partially working:** the code-level cause is fixed and locally validated, but this report does not claim a successful spoken session on the newly deployed Cloudflare bundle. A human microphone run on approved desktop and mobile browsers remains required after deployment.

## What is partially working

- **Showtimes:** current published schedules are available and the refresh transaction succeeded. Daily automation is configured, but the first scheduled/manual GitHub workflow run still needs evidence. Public-site routes are a temporary bridge, not a service-level agreement.
- **Voice:** CSP-safe startup is implemented and statically validated. Hosted WebRTC, origin policy and real microphone/device acceptance remain pending.
- **Seats and pricing:** selection, derived count and preview quote behavior work locally. Authoritative seat holds, concurrent conflict handling, official fees and expiry require server APIs.
- **Checkout and booking:** the local end-to-end presentation works, but it creates only a device-local reference.
- **Cancellation:** a local stored booking can be found and marked cancelled. No remote booking ownership check, cancellation write or refund is performed.
- **QR:** the rendered QR contains a local reference and is not a cinema-entry ticket or wallet pass.
- **Offers:** current media and structured guidance display, but bank validation and redemption are not connected.
- **Customer Care:** a redacted transfer summary can be prepared, but no Genesys/OneView connection is made.
- **FAQ:** bilingual deterministic answers exist; production publication approval, freshness ownership and knowledge synchronization are still required.
- **Navigation:** in-widget Back and FAQ return preserve the intended stage. A full document exit/reload does not preserve every in-memory booking step without an approved persistence design.
- **Accessibility and device coverage:** local 420 px English/Arabic inspection passed without document-level horizontal overflow. Physical device, screen-reader, keyboard-only and design sign-off remain open.

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
| Current revision is not yet deployed and fully retested on Cloudflare | Deployment/QA owner | Local and hosted parity is not yet evidenced |
| First recurring GitHub refresh run is not yet evidenced | Repository/data owner | Automation is configured but not operationally proven |
| Hosted desktop/mobile microphone acceptance is pending | QA/device lab and ElevenLabs agent owner | Spoken journey is not release-qualified |
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
10. Complete human English/Arabic voice acceptance after deployment, covering first start, reconnect, text-to-voice continuation, discovery filters, FAQ interruption, seat selection and checkout return.

No dashboard change is needed to weaken CSP; the application now serves the required worklets itself.

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

## Local test results

| Scenario | Result | Evidence/notes |
| --- | --- | --- |
| Fresh 16 July showtimes | Pass | 1,439 sessions; 16–22 July coverage |
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
| Poster, experience and offer media | Pass | Compact cards/fallback behavior verified |
| White/blue theme at 420 px | Pass | No document-level horizontal overflow in inspected states |
| Voice source/CSP contract | Pass | Both self-hosted worklets, strict CSP, paths, timeouts and bilingual errors validated |
| Local live microphone conversation | Not claimed | Human device acceptance required |
| Current revision on Cloudflare | Not claimed | Deploy and hosted matrix still required |
| Recurring GitHub workflow execution | Not claimed | Workflow exists; first run evidence pending |

## Screenshot and log evidence

| Evidence file | Content |
| --- | --- |
| `evidence/logs/showtime-voice-theme-local-acceptance.md` | Refresh facts, local scenario matrix, voice root cause/fix and remaining hosted gates |
| `evidence/logs/local-browser-e2e.md` | Earlier detailed local journey and hosted-baseline observations |
| `evidence/logs/pnpm-run-validate.txt` | Repository validation command output from the preceding tested revision; retain as historical command evidence until refreshed for this revision |
| `evidence/logs/pnpm-run-build.txt` | Production build output from the preceding tested revision; retain as historical command evidence until refreshed for this revision |
| `evidence/screenshots/local-white-blue-july16-420.png` | White/blue current-date result at 420 px |
| `evidence/screenshots/local-generic-filtered-july16-420.png` | Generic discovery routing and filtered July 16 results |
| `evidence/screenshots/local-arabic-white-blue-july16-420.png` | Arabic/RTL white-and-blue state at 420 px |
| `evidence/screenshots/local-booking-qr-white-blue-420.png` | Booking confirmation and local reference QR in the new theme |
| `evidence/screenshots/local-checkout-seat-derived-420.png` | Seat-derived checkout count and pricing |
| `evidence/screenshots/local-cancellation-confirmed-420.png` | Local cancellation confirmation and cleanup |
| `evidence/screenshots/hosted-old-date-misroute-420.png` | Historical hosted failure baseline; not current-revision pass evidence |

## Release gates

Leadership review of the current local schedule/display/checkout-preview journey can proceed. Before stating local/web parity, deploy this exact revision and repeat the critical hosted text, Arabic, navigation, media, QR, cancellation and microphone checks.

A customer production launch additionally requires:

1. A clean install, complete validation and production build for the final revision with archived logs.
2. Exact tested-revision deployment to Cloudflare with asset identity and security headers recorded.
3. Successful manual and scheduled refresh runs with alerting, ownership and rollback evidence.
4. Hosted English/Arabic text acceptance and human voice acceptance on approved desktop and mobile browsers.
5. Licensed inventory, hold, quote, payment, booking, official ticket and cancellation/refund services.
6. Security, privacy, PCI, accessibility, performance and data-licensing approval.
7. Approved bilingual knowledge and offer content with operational freshness controls.
8. Monitoring, incident ownership, support handover and rollback readiness.

Until customer transaction services and these launch gates are complete, production sales remain **NO-GO**.
