# VOXi production-readiness report

Report date: 15 July 2026 (Asia/Dubai)
Repository: `Noorul-Ameen/vox-cinemas-agent`
Cloudflare URL audited: <https://voxi-ai.pages.dev/>
StackBlitz URL: <https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

## Executive decision

**Production release status: NO-GO.**

The repository passes the complete automated validation suite and production build, and the current source has been exercised locally at 420 px through filtered discovery, seats, editable checkout return, FAQ interruption, booking/QR rendering, cancellation and Arabic/RTL. Commit `4269339` is now on `main`, and Cloudflare serves the same tested `assets/index-B6np26pn.js` bundle with the new security and cache headers. This deployment smoke check proves artifact identity, not complete hosted interaction or spoken acceptance.

Production sales must remain gated until authenticated inventory, reservation, booking, payment, cancellation/refund, official ticket/QR, offer-redemption and customer-service connectors are available. The current browser-side transaction path is suitable for leadership journey review, but it must not be represented as completing a live VOX sale.

## Scope and protected integration contract

The following are intentional constraints and must remain unchanged during readiness work:

- ElevenLabs voice transport uses WebRTC with `serverLocation: "eu-residency"`.
- The existing client-tool names remain unchanged: `show_movie_selection`, `show_showtimes`, `show_seat_map`, `select_seats`, `show_booking_summary`, and `show_booking_for_cancellation`.
- `show_seat_map` remains non-blocking.
- The protected `select_seats` contract and fuzzy movie/session resolvers remain intact.
- The 420 px mobile layout remains a supported layout target.
- Real secrets must never be placed in a `VITE_*` value or committed to the repository.

## Current repository status

### What works in the implementation

- Movie discovery retains supplied cinema/location, date, preferred time, genre, movie language, experience/format, specific title and kids/family intent. It asks only for missing information and routes text and voice transcripts through the same discovery logic.
- Filtered results apply retained criteria. Preferred-time requests support a clearly labelled closest-time fallback when there is no exact match.
- Current availability is filtered using UAE time and the cinema programming-day boundary, including after-midnight sessions.
- There is no separate ticket-quantity stage, selector or plus/minus control. Each selected seat is one ticket.
- A spoken or typed quantity is stored only as a target for seat guidance. It does not create tickets, determine price or block checkout.
- Seat add/remove actions invalidate the prior checkout order and refresh the quote. Checkout count, subtotal, fees and total are derived from the selected seats and returned quote.
- Checkout can return to the same editable seat map. Changing an upstream cinema, date, movie or showtime clears incompatible seats and pricing.
- The unified conversation renders one current interactive stage, preventing old movie, showtime, seat or checkout controls from remaining actionable in the transcript.
- Text startup has a microphone-free path. Voice starts only from the microphone action and retains the protected WebRTC/EU-residency configuration.
- Explicit English/Arabic selection, RTL presentation, journey continuity, cancellation confirmation cleanup, booking persistence and local booking status updates are implemented.
- Movie posters and experience imagery have compact layouts and fallback handling. Completed local bookings persist a poster reference when one is available.
- `public/_headers` defines CSP, permissions, referrer, HSTS, MIME-sniffing and immutable hashed-asset cache policies for a future Cloudflare deployment of this revision.

The command logs, local browser acceptance log and screenshots supporting these statements are listed below. Spoken acceptance and current-build hosted acceptance remain open gates.

### Partially working

- **Voice:** the client connection and shared routing are implemented, but production behavior depends on the target ElevenLabs agent configuration, origin allow-list, microphone permission, browser/device WebRTC behavior and the dashboard prompt/tool schemas. Automated browser control could not complete a microphone session, so this report does not claim current-build spoken acceptance.
- **Showtimes:** the shipped snapshot is internally structured and date-aware, but it covers a finite extraction window. It cannot provide ongoing live inventory after the snapshot expires.
- **Seat plan and pricing:** browser behavior and quote normalization exist, but production-grade inventory locks, concurrent-seat conflict handling, authoritative fees and expiry are unavailable without server APIs.
- **Checkout and booking:** the full UI journey, local reference and local history work on one browser/device. No authoritative VOX booking is created.
- **Cancellation:** local stored bookings can be found and marked cancelled. Remote booking verification, eligibility, refund initiation and status require authenticated services.
- **QR:** the rendered reference QR represents the local booking reference. It is not an official cinema-entry ticket or wallet pass.
- **Offers:** structured rules and imagery can guide the guest, but eligibility is provisional and redemption is not connected.
- **Customer Care handover:** a redacted summary can be prepared, but no Genesys/OneView transfer is performed.
- **FAQ:** deterministic bilingual answers exist, but publication governance, customer approval, source freshness and a production knowledge-sync process are still required.
- **Native browser Back/Forward:** in-widget FAQ and checkout Back actions preserve their parent state. Native browser Back leaves the single-page document and Forward reloads it successfully, retaining locale but not the in-memory journey; preserving an unfinished transaction across a full document navigation would require an approved persistence design.
- **Visual quality:** current local English and Arabic 420 px sweeps show compact posters and no document-level horizontal overflow. Physical target-device, assistive-technology and design sign-off remain outstanding.
- **Agent response grounding:** the deterministic widget results are authoritative, but one text run produced a “no kids movies” sentence while the widget correctly displayed two filtered family titles. Selected-booking grounding was strengthened and retested, but ElevenLabs dashboard prompt/tool-response acceptance is still required before leadership or production voice sign-off.

### What does not work as a live production operation

- Authoritative seat reservation or lock against VOX inventory.
- Hosted/PCI payment authorization, capture, reversal or wallet payment.
- Creation of an official booking or cinema-entry QR/ticket.
- Authenticated lookup of a customer's bookings across devices.
- Server-side cancellation/refund execution and refund status tracking.
- Real-time offer redemption or bank-side validation.
- Transactional food-and-beverage ordering.
- Genesys transfer or OneView write.
- Guaranteed current schedules once the shipped snapshot is outside its published date range.

### Blocked items

| Blocker | Owner/dependency | Release impact |
| --- | --- | --- |
| Complete current-build hosted regression is not yet evidenced | QA/Cloudflare owner | Artifact deployment passed, but hosted interaction acceptance remains incomplete |
| ElevenLabs dashboard prompt, tools, first message and allowed origins require verification | ElevenLabs agent owner | Voice behavior and continuity are not guaranteed |
| Production read/write API contracts and server credentials are unavailable | VOX platform/API owners | No live inventory, booking, payment, cancellation or refund |
| Official FAQ/policy content approval and freshness ownership are unassigned | CX/content/legal owners | Customer answers cannot be treated as production policy |
| Target-device microphone/WebRTC acceptance is incomplete | QA/device lab | Spoken journey is not release-qualified |
| Physical-device responsive/RTL/accessibility sign-off is incomplete | QA/product design | Release visual and accessibility sign-off is incomplete |
| The production bundle is 2,948.10 kB minified (423.12 kB gzip) | Web performance owner | Code/data splitting and performance budgets require review |

## Required ElevenLabs dashboard changes

Apply these changes to agent `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`. Do not rename the protected tools, change `select_seats`, or change the EU-residency connection.

1. Confirm all eight client tools are enabled with schemas matching the web client. The original six names stay unchanged; `show_offers` and `handover_to_agent` must be present for those features.
2. Add the progressive-discovery rules from `ELEVENLABS_AGENT_SETUP.md`: extract supplied criteria, ask only for missing information, preserve preferences, filter with all criteria, and state when nearest times are shown.
3. Remove any prompt instruction that asks for ticket quantity as a separate step. The prompt must state that selected seats are the only ticket-count and pricing source; a quantity utterance is only a seat-selection target.
4. Require upstream changes to discard incompatible seat and quote context before another checkout.
5. Configure the first-message field as `{{voxi_session_opening}}`. Keep `voxi_is_continuation`, `voxi_session_id`, `voxi_previous_conversation_id`, `voxi_intent`, `voxi_movie`, `voxi_cinema`, and `voxi_booking_progress` available to the prompt.
6. Preserve strict language selection: do not switch language from detection alone; explicit user confirmation or a visible language-control action is required.
7. Allow WebRTC/public-agent access only from approved production, StackBlitz and local QA origins. Verify the final Cloudflare origin explicitly.
8. Retain the payment-data prohibition. The agent must never request spoken/typed PAN, expiry, CVV, OTP, PIN or password.
9. Perform human voice acceptance in English and Arabic, including text-to-voice continuation, no repeated welcome, FAQ interruption during booking, target seat count, seat-label selection and return from checkout.

## Required API and knowledge-base changes

### Transaction and customer APIs

- **Schedule/inventory gateway:** authenticated, server-side cinema/film/session reads with UAE programming-date semantics, session status, experience, language, auditorium and freshness metadata.
- **Seat inventory/reservation:** authoritative seat map, accessibility metadata, hold creation, hold expiry, conflict response, release and idempotency keys.
- **Quote service:** server-authoritative ticket types, taxes, fees, discounts, offer application, currency and quote expiry tied to the seat hold.
- **Hosted payment service:** PCI-compliant hosted fields/redirect, 3DS, authorization/capture, retry, decline, timeout, reversal and webhook reconciliation. No payment secrets may pass through Vite or ElevenLabs.
- **Booking service:** idempotent order creation, official booking reference, ticket/QR payload, email/SMS delivery and durable status.
- **Booking lookup/account:** authenticated cross-device booking history, VOX Wallet/Credit and loyalty balance where approved.
- **Cancellation/refund:** booking ownership verification, policy/eligibility decision, cancellation write, refund route/reference/status and audit trail.
- **Offers:** current campaign/card terms, eligibility inputs, usage limits, application and redemption confirmation.
- **Food and beverage:** venue/session menu, availability, basket pricing and fulfilment if transactional F&B remains in product scope.
- **Customer Care:** Genesys/OneView connector with consent, transfer state, correlation ID and a response that distinguishes “summary prepared” from “agent connected.”
- **Observability:** privacy-safe event IDs, API latency/error telemetry, tool invocation outcomes, abandonment stages and correlation across client, ElevenLabs and server services. Do not log transcripts or payment data without approved policy.

### Knowledge-base governance

- Move customer-approved policy/editorial answers to a versioned CMS or ElevenLabs knowledge base; keep inventory, prices, showtimes, offers, bookings and balances API-driven.
- Require stable article ID, English and Arabic content, source URL, content owner, reviewer, approval date, expiry/review cadence and customer/internal audience classification.
- Separate customer-facing answers from internal SOP and escalation material.
- Implement validated delta sync, link checking, schema checks, locale-completeness checks and rollback to the last approved version.
- Assign owners for fast-changing topics such as refunds, accessibility, age rules, cinema hours, card campaigns and contact channels.

## Test evidence for the final local revision

### Repository command evidence

- `pnpm run validate` completed with `EXIT_CODE=0`. All 24 validator programs passed, covering 22 cinemas, 42 films, 4,344 sessions, nine programming dates, discovery filters, nearest-time fallback, UAE expiry, seat-derived ticketing, cancellation safety, text/voice routing parity, bilingual strings and protected invariants.
- `pnpm run build` completed with `EXIT_CODE=0`. Vite transformed 1,540 modules and produced `dist/assets/index-B6np26pn.js` at 2,948.10 kB minified / 423.12 kB gzip.
- The bundle-size warning remains open. The 2.08 MB schedule snapshot is the largest source payload; code/data splitting and an explicit performance budget are recommended.
- This workspace supplied dependencies through the Codex bundled runtime and did not rerun `npm ci`. Cloudflare's documented clean-build command remains `npm ci && npm run validate && npm run build`.

### Scenario matrix

| Scenario | Automated coverage | Current local browser evidence |
| --- | --- | --- |
| Cinema already provided is not asked again | Pass | Pass |
| Date already provided is not asked again | Pass | Pass |
| Preferred time filters results | Pass | Pass |
| Genre filtering | Pass | Pass: three Comedy titles around 20:00 |
| Kids/family filtering | Pass | Widget pass; one contradictory ElevenLabs sentence observed and recorded as a grounding risk |
| Experience filtering | Pass | Pass: IMAX-only sessions |
| Specific movie filtering | Pass, including guarded fuzzy resolution | Pass: Toy Story 5 only |
| Combined cinema/date/time | Pass | Pass at 420 px in English and Arabic |
| No exact time shows nearest options | Pass | Pass with explicit closest-time notices |
| Changing genre/experience refreshes results | Pass | Pass |
| Changing cinema/date/time clears incompatible state | Pass | Pass from a selected-seat state |
| Ticket count comes only from selected seats | Pass | Pass: 3/AED 126, then 2/AED 84 |
| Checkout Back restores editable seats | Pass | Pass; A4 was replaced by A5 and checkout regenerated |
| Text and voice consistency | Same transcript router passes | Spoken run blocked by microphone permission; no live voice pass claimed |
| FAQ interruption during booking | Pass | Pass; three seats and quote restored |
| Cancellation confirmation rendering | Pass | Pass after runtime fall-through fix |
| Browser Back/Forward | In-widget state paths pass | Native Back/Forward reload pass; in-memory journey does not survive document exit |
| Poster rendering and 420 px layout | Pass | Pass locally in English/Arabic; device sign-off pending |
| Current showtime validation | Pass | Future sessions used locally; deployed expired-session retest pending |

### Cloudflare deployment status and pre-deployment baseline

Post-push verification of <https://voxi-ai.pages.dev/> confirmed:

- GitHub `main` is commit `4269339`, and Cloudflare serves `assets/index-B6np26pn.js`, matching that commit's final local production build.
- HTML is returned with `no-cache, no-store, must-revalidate`; CSP, HSTS and `Permissions-Policy: microphone=(self)` are active.
- This is an artifact/header smoke check only. The complete current-build hosted scenario matrix and human microphone run remain release gates.

The earlier runtime audit remains useful as a pre-deployment failure baseline. Observed on that older deployment:

- The hosted script was `assets/index-BgMP9HrN.js`; the final local build is `assets/index-B6np26pn.js`.
- “Mall of the Emirates tomorrow at 6 PM” displayed all 19 films instead of filtering around 6 PM.
- In the final spot check, “Actually, July 15 at 6 PM” was misrouted to the 15+/18+/21+ age-rating FAQ and the agent incorrectly said only 16 July could be shown.
- FAQ interruption and return preserved selected seat A1.
- Checkout Back returned to the seat map.
- All 19 tested poster requests loaded; cards rendered at approximately 104 × 156 px with no horizontal page overflow.
- Header/date-chip/showtime-experience truncation was visible and needs comparison against the current revision.
- An expired same-day session could progress to checkout; the current repository contains an expiry guard that still requires deployed verification.
- Automated microphone control timed out, so no hosted voice pass is claimed.
- The audited response exposed referrer and MIME-sniffing headers but not the CSP, HSTS or Permissions-Policy now defined in the repository's `public/_headers`. Root and asset caching remained `public, max-age=0, must-revalidate`; the main JavaScript asset was approximately 2.9 MB.

Completed deployment checks:

1. Recorded deployed commit `4269339` and matching asset `index-B6np26pn.js`.
2. Confirmed Cloudflare serves the current `_headers` policy for HTML and one-year immutable caching for the hashed asset.

Remaining hosted acceptance:

1. Run the complete scenario matrix in English text at 420 px.
2. Repeat critical discovery, seat, checkout, FAQ and cancellation paths in Arabic/RTL.
3. Perform human voice checks on an approved desktop and mobile browser with microphone permission.
4. Test native Back/Forward, refresh during each transactional stage and expired-session behavior.
5. Capture console/network logs with secrets and customer data excluded.

## Screenshot and log evidence manifest

Evidence below is for the current local source unless the filename says `hosted-old`. The header log proves current deployment identity, but no evidence claims a complete hosted scenario or spoken voice pass.

| Evidence file | Content | Status |
| --- | --- | --- |
| `evidence/logs/pnpm-run-validate.txt` | Complete validation output with `EXIT_CODE=0` | Present |
| `evidence/logs/pnpm-run-build.txt` | Successful Vite build, asset name/size and `EXIT_CODE=0` | Present |
| `evidence/logs/local-browser-e2e.md` | Detailed local and hosted scenario outcomes, including observed risks | Present |
| `evidence/logs/cloudflare-headers.txt` | Pre-deployment baseline and post-push asset/header verification | Present; confirms current asset deployment |
| `evidence/screenshots/local-filtered-combined-420.png` | English combined cinema/date/time filtering at 420 px | Present |
| `evidence/screenshots/local-checkout-seat-derived-420.png` | Three-seat checkout, subtotal, fees and total | Present |
| `evidence/screenshots/local-booking-qr-420.png` | Booking summary, compact poster and reference QR boundary | Present |
| `evidence/screenshots/local-cancellation-confirmed-420.png` | Device-only cancellation status and no-refund wording | Present |
| `evidence/screenshots/local-arabic-filtered-420.png` | Arabic/RTL combined filtering at 420 px | Present |
| `evidence/screenshots/hosted-old-date-misroute-420.png` | Old hosted build misrouting a date/time turn to age-rating FAQ | Present; failure evidence |
| Browser console/network export | The in-app browser did not expose an event export; no pass is claimed | Blocked by test surface |

## Release acceptance gates

Leadership journey review may proceed only after gates 1–5. A customer production launch requires all gates.

1. Final validation and production build are green with attached logs; the deployment pipeline must still prove its clean `npm ci` install.
2. The exact tested revision is deployed to Cloudflare and its asset hash/security headers are recorded. **Passed for commit `4269339`.**
3. Every requested text scenario passes on the hosted build, including filtered discovery, nearest times, seat-derived pricing, checkout return, cancellation and FAQ restoration.
4. English/Arabic, 420 px responsive, poster, native Back/Forward, refresh and rendering evidence receives QA/design sign-off.
5. ElevenLabs dashboard configuration and human voice checks pass on approved desktop and mobile browsers.
6. Production APIs provide authenticated inventory, holds, quotes, hosted payment, booking, official tickets, cancellation/refund and idempotency.
7. Security/privacy review approves CSP/origins, secret handling, data retention, logging, PCI boundary and accessibility.
8. Customer-facing knowledge content and offer rules have named owners, bilingual approval and freshness controls.
9. Monitoring, alerting, rollback, incident ownership and support handover are operational.

Until the applicable gates close, the release decision remains **NO-GO**.
