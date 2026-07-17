# VOXI Final Validation Report

Date: 17 July 2026

## Executive status

The current local build is ready for leadership review. The booking concierge now keeps the logical booking journey while temporarily hiding an unrelated rich screen, restores the correct screen on request, supports contextual booking cancellation, and preserves the same interaction rules for text and voice transport.

No known repository-level functional defect remains in the tested scope. Production ticket sales are still conditional on the external VOX reservation, payment, refund, live seat inventory, and live showtime APIs. The current checkout produces a device-only saved booking summary. It does not charge a card or reserve cinema inventory.

The latest changes in this report were validated locally before publication. Cloudflare verification is performed after the associated main-branch commit is received because deployment cannot precede that commit.

## Root causes and fixes

### Rich journey screens remained visible during unrelated topics

Root cause: the visible rich component and the logical booking stage shared the same state. Hiding a component therefore risked deleting the user's booking context, while retaining the state kept an unrelated screen mounted.

Fix: visibility is now independent from the logical stage. A paused journey snapshot stores the last valid rich stage, selected movie, cinema, date, showtime, seats, pricing, and checkout context. An unrelated FAQ or offer hides the rich component immediately without clearing the journey.

Supported restore requests include:

- Continue my booking
- Continue where I stopped
- Go back to seats
- Show showtimes
- Return to checkout
- Continue cancellation

Checkout restoration revalidates the selected session, seats, and calculated price before showing the checkout again. Explicit journey cancellation, reset, timeout, completion, or replacement clears the lifecycle state.

### A delayed agent tool call could advance a restored screen

Root cause: an agent response that began before an FAQ could arrive after the user restored showtimes. That stale response could advance the journey to a seat map for the first showtime.

Fix: restored stages now reject stale stage-changing tool effects. The mounted browser test waited for the delayed response and remained on showtimes.

### Cancellation phrases started a new movie search

Root cause: movie names and relative phrases were routed through general discovery before the active cancellation context was resolved.

Fix: cancellation has priority while its lifecycle is active. The resolver now evaluates stored booking reference, movie, date, time, cinema, visible list position, relative date phrases, and phrases such as this movie. A unique eligible match is selected. Multiple matches produce a focused clarification containing only distinguishing booking details. Cancelled or otherwise ineligible records are reported without starting discovery.

### Confirmation language was incomplete and yes variants failed

Root cause: the prompt and local fallback did not share a single confirmation contract, and punctuation in phrases such as Yes, cancel it prevented a match.

Fix: confirmation now includes movie, cinema, date, time, booking reference, device-only impact, and a direct yes or no question. Natural variants such as yes, confirm, cancel it, no, keep it, and never mind are normalized before routing. Confirmation updates the stored booking and preserves it in full history with cancelled status.

### History and language changes could lose the visible screen

Root cause: Continue where I stopped originally targeted booking stages only, and punctuation-only voice transcript noise could be treated as an unrelated message during language switching.

Fix: restoration includes booking history and cancellation stages. Punctuation-only transcript fragments are ignored. Switching between English and Arabic preserves the mounted journey while changing interface direction and conversation language.

## State storage and restoration

The paused rich journey is held in React session state for the current widget session. Completed and cancelled booking records remain in browser localStorage on that device. No private customer information or real payment credential is written by this application.

The paused snapshot includes the minimum state required to restore:

- movie discovery results and filters
- cinema, date, preferred time, genre, language, and experience
- selected movie and showtime
- selected seats and the price derived from those seats
- checkout summary state
- cancellation candidates and confirmation state
- booking history view

One selected seat equals one ticket. Seat count, subtotal, fees, and checkout total are recalculated from selected seats. There is no independent ticket quantity selector.

## Cancellation matching and ambiguity

Matching is deterministic and uses eligible stored bookings only. Exact normalized matches are preferred, with conversational date and time parsing used to narrow the set.

Examples covered by automated or mounted tests:

- cancel by booking reference
- cancel by movie title
- cancel the first or second booking from the visible list
- cancel by date, showtime, or cinema
- cancel this movie within active cancellation context
- clarify two bookings for the same movie using date, time, cinema, and reference
- reject an already cancelled booking
- decline a cancellation and keep the booking
- pause cancellation for an FAQ, then continue cancellation

The current data operation updates browser localStorage only. A real refund or cinema cancellation is not submitted.

## ElevenLabs and tool integration

Contract version: `2026-07-17.5`

Normalized prompt contract hash: `3fcaa0926b51d026ba98f749608dc94c34a8a4aa7a3540e75ac1c87d35480b5a`

The repository prompt contract now requires the same lifecycle, restoration, cancellation, concise confirmation, language, and punctuation behavior as the widget. The contextual contract is also provided when the widget starts an ElevenLabs session.

Protected integration details were not changed:

- ElevenLabs client-tool names
- `select_seats`
- `serverLocation: "eu-residency"`
- fuzzy movie and session resolvers
- 420 px mobile layout target

The exact repository prompt was published to the active ElevenLabs agent branch on 17 July 2026. The configuration was reopened after publication and the paused-journey, booking-history, and secure-payment rules were confirmed as persisted. The prompt payload contains 15,010 normalized characters across 65 lines and has SHA-256 `7ca6dd42e9935e66c52822c5fe1c4ddbb0139485f598351dc136f0bebc6677cd`.

Voice WebRTC startup succeeded in the mounted browser and reached Voice chat status. Text and voice use the same routing and state functions. Automated tests validate that shared route contract. A real spoken acoustic utterance was not injected into the microphone during automation, so one manual microphone recognition pass remains required on the deployed HTTPS site.

## Files changed

Primary implementation:

- `src/App.jsx`
- `src/components/BookingHistory.jsx`
- `src/lib/pausedRichJourney.js`
- `src/lib/pausedJourneyRouting.js`
- `src/lib/conversationalCancellationResolver.js`
- `src/lib/cancellationConfirmation.js`
- `src/lib/cancellationRouting.js`
- `src/lib/voxiSession.js`

Agent contract:

- `config/elevenlabs-agent-contract.json`
- `ELEVENLABS_AGENT_SETUP.md`

Validation coverage:

- `scripts/validatePausedRichJourney.mjs`
- `scripts/validatePausedJourneyRouting.mjs`
- `scripts/validatePausedConversationIntegration.mjs`
- `scripts/validateConversationalCancellationResolver.mjs`
- `scripts/validateCancellationConfirmation.mjs`
- `scripts/validateConversationLifecyclePrompt.mjs`
- existing conversation, checkout, seat, cancellation, discovery, offer, annotation, and punctuation validators
- `package.json`

## Automated validation evidence

Final `pnpm run validate` result: passed.

Validated data and scope:

- 22 cinemas
- 37 films
- 9,668 showtime sessions
- 20 dates from 17 July 2026 through 5 August 2026
- 1,464 sessions for 17 July 2026
- 1,446 sessions for 18 July 2026
- paused journey storage, hiding, restoration, and cleanup
- restoration intent routing
- cancellation matching, ambiguity, confirmation, decline, and persistence
- checkout continuity and seat-derived quantities
- conversational discovery progression
- FAQ and offer fallback behavior
- text and voice shared routing contract
- customer-facing punctuation validation across 418 repository text files

The punctuation validator confirms that customer-facing responses do not contain an em dash or en dash.

Final `pnpm run build` result: passed.

- Vite transformed 1,556 modules
- main bundle gzip size: 236.32 KB
- main bundle brotli size: 214.28 KB
- gzip budget: 256 KB
- brotli budget: 230.4 KB
- generated main asset: `index-DN-kNQev.js`
- generated ElevenLabs transport asset: `ElevenLabsTransport-B93VRWWf.js`

`git diff --check` passed, with only line-ending notices from the Windows checkout.

## Mounted browser end-to-end evidence

The production build was exercised at `http://127.0.0.1:4173/` in a 420 px viewport.

Passed scenarios:

- family movies at Mall of the Emirates tomorrow returned three filtered movie cards
- compact poster rendering measured 56 by 80 px per card
- widget width measured 388 px within a 420 px document, with no horizontal overflow
- Toy Story 5 selection displayed its relevant showtimes
- an FAQ hid the movie panel and Continue my booking restored it
- an FAQ hid showtimes and Show showtimes restored them
- a delayed tool response did not advance restored showtimes
- selecting 5 PM opened the exact 17:00 seat map
- an FAQ hid the seat map and Go back to seats restored it
- selecting E1 and E2 produced a two-ticket checkout
- an FAQ hid checkout and Return to checkout revalidated and restored it
- Edit seats retained E1 and E2
- removing E2 recalculated one seat to AED 42
- adding E3 recalculated two seats to AED 84
- checkout reflected E1 and E3 in the same order
- completing review checkout saved booking reference WLGM7VG and displayed its QR code
- confirmation clearly stated that no payment or cinema reservation was submitted
- cancellation by movie and visible list position worked
- Yes, cancel it marked the booking cancelled
- current bookings excluded the cancelled record while full history retained it
- cancellation paused for an FAQ and Continue cancellation restored it
- booking history paused and Continue where I stopped restored all visible history groups
- the FAB offer displayed detailed content without destroying checkout state
- Return to checkout restored the exact E1 and E2 selection in the offer test
- cancelling the active journey cleared pending checkout but retained stored history
- Voice chat started successfully
- Arabic history rendered right to left
- switching back to English retained the history screen and records
- browser console error and warning capture returned an empty list

Visual captures taken during the mounted test show:

- the 420 px booking history layout
- the 420 px two-column movie grid with compact posters
- the 420 px checkout with seat and price summary

These captures were made in the task browser and were not added to the repository.

## Capability status

### Works

- progressive movie discovery using cinema, city, date, time, genre, audience, language, movie, and experience criteria
- relevant movie and showtime filtering with nearby-time fallback
- movie, showtime, seat, checkout, QR summary, history, and cancellation rendering
- seat-derived ticket count and pricing
- editing seats from checkout
- pause and restore for movie results, showtimes, seats, checkout, cancellation, and history
- detailed bank offer presentation while preserving the booking journey
- English and Arabic interface and conversation routing
- text interaction without microphone dependency
- ElevenLabs WebRTC voice startup
- conversational booking cancellation against device-stored history
- 420 px mobile layout

### Partially working

- voice transport starts and shares all application routes, but final acoustic recognition depends on the user's microphone, browser permission, ElevenLabs availability, and published agent configuration
- showtimes are current in the repository snapshot, but freshness on the public site depends on the scheduled data refresh and successful Cloudflare deployment
- checkout and QR generation are complete for a review booking summary, but no cinema inventory is reserved
- cancellation updates device history, but does not call a VOX refund or cancellation service

### Blocked by external systems

- real seat inventory locking
- real ticket reservation
- card authorization and payment capture
- refund execution
- server-backed customer booking history across devices
- authoritative live VOX showtime API access
- deploying this final source set to Cloudflare

### Known repository defects

None found in the tested scope after the final validation run.

## Required production integrations

Before enabling real transactions, provide:

- authenticated VOX cinema, movie, showtime, format, and seat-inventory APIs
- temporary seat-hold and expiry APIs
- secure hosted payment handoff and callback verification
- server-side booking creation and status retrieval
- cancellation eligibility, cancellation submission, and refund-status APIs
- authenticated customer identity and cross-device booking history
- monitoring for data refresh, booking failures, payment callbacks, and agent tool errors
- a scheduled deployment check confirming refreshed showtimes reached Cloudflare

ElevenLabs should receive the exact prompt contract in `config/elevenlabs-agent-contract.json`, while retaining the current agent ID, EU residency, and existing tool names. The production domain must remain allowed for WebRTC and microphone access.

## Final readiness decision

Leadership review readiness: ready after this source set is pushed and deployed.

Repository functional validation: passed.

Local visual validation: passed at the required 420 px layout.

Cloudflare validation for this final source set: pending deployment.

Real transaction production readiness: blocked by the VOX booking, payment, refund, identity, and live inventory integrations listed above.
