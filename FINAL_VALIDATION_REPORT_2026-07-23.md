# VOXi final validation report

Date: 23 July 2026, UAE

Production URL: <https://voxi-ai.pages.dev/>

Repository: <https://github.com/Noorul-Ameen/vox-cinemas-agent>

Branch: `main`

Validated runtime source commit: `1af1d1908545483ff9659288fc645fac7fdda6d9`

Snapshot: `20260723-180b0b07f8429acf`

Hosted production asset: `/assets/index-DqBCeyow.js`

## Executive status

The runtime source was correctly published and tested at the production URL. During functional validation, production `release.json` returned the exact runtime commit `1af1d1908545483ff9659288fc645fac7fdda6d9` and snapshot `20260723-180b0b07f8429acf`. The hosted JavaScript asset is `/assets/index-DqBCeyow.js`, is 889,938 bytes, and is served with immutable caching. Production `release.json` remains the source of truth for the current deployment commit after documentation-only updates.

The full local validator suite and production build passed. Local E2E passed 23 of 23 tests. The hosted exact-commit smoke passed 1 of 1, and hosted E2E passed 23 of 23. The package audit found no known production vulnerabilities, and the secret scan was clean.

Live Chrome passed an Arabic rating query and retained the movie list. Controlled Chrome passed microphone-denial recovery after 45 seconds and retained state. Acoustic English and Arabic recognition and audible output remain a human normal-browser acceptance gate.

This release is ready for production use as a discovery and booking-preview experience. It is not ready for live ticket sales because it has no live inventory, hold, payment, official ticket QR, provider cancellation, refund, or handover APIs.

## Release and data verification

| Item | Verified result |
| --- | --- |
| Production branch | `main` |
| Runtime release commit | `1af1d1908545483ff9659288fc645fac7fdda6d9` |
| Functional test deployment commit | Exact runtime source match |
| Snapshot | `20260723-180b0b07f8429acf` |
| Production `release.json` snapshot | Exact match |
| Hosted asset | `/assets/index-DqBCeyow.js` |
| Hosted asset size | 889,938 bytes |
| Hosted cache policy | Immutable |
| Sessions | 10,606 |
| Films | 35 |
| Cinemas | 22 |
| Dates | 21, through 2026-08-12 |
| Sessions today | 1,116 |
| Sessions tomorrow | 1,398 |
| Schedule shards | 320 |
| Official movie-information records | 83 |

## Validation summary

| Area | Result |
| --- | --- |
| Full local validators | PASS |
| Production build | PASS |
| Local E2E | 23/23 PASS |
| Hosted exact-commit smoke | 1/1 PASS |
| Hosted E2E | 23/23 PASS |
| Package audit | No known production vulnerabilities |
| Secret scan | Clean |
| Live Chrome Arabic rating query | PASS, movie list retained |
| Controlled Chrome microphone-denial recovery | PASS after 45 seconds, state retained |
| ElevenLabs contract publication and readback | PASS |
| Acoustic English and Arabic speech and audible output | HUMAN ACCEPTANCE REQUIRED |
| Live transactions | BLOCKED |

## What works

- The production root serves the release identified by the exact commit and snapshot in `release.json`.
- Text mode starts without microphone permission.
- English and Arabic discovery use one retained journey state.
- Cinema, city, date, time, genre, language, experience, movie, and audience filters work through the validated flows.
- Exact visible movie and showtime selection routes deterministically.
- Movie rating, child-suitability, runtime, language, genre, synopsis, and subtitle guidance use grounded data and explicit unknown handling.
- One selected seat equals one ticket, and seat changes recalculate the preview total.
- Checkout, FAQ detours, return to checkout, and seat editing preserve expected state.
- Device-local booking history, local references, and device-only cancellation are disclosed as local behavior.
- The hosted exact-commit smoke and all hosted E2E scenarios passed.
- A live Chrome Arabic rating query passed, and the movie list remained visible.
- Controlled Chrome recovered from denied microphone permission after 45 seconds without losing state.
- Contract `2026-07-23.3` was published to ElevenLabs and read back successfully.
- Package and secret checks passed.

## What does not work

- The app does not read live seat inventory.
- The app does not create or maintain seat holds.
- The app does not authorize or capture payment.
- The app does not issue an official provider booking or admission ticket QR.
- The app does not cancel a provider booking or issue a refund.
- The app does not send a live customer-care handover.
- Device-local booking records are not cross-device provider records.

## What is partially working

- Voice transport configuration, language routing, bounded startup, error classification, and microphone-denial recovery are validated. Acoustic English and Arabic speech recognition and audible output still need a person to test in a normal browser.
- Offer guidance is available, but eligibility, pricing, and redemption must be verified at official checkout.
- Schedule discovery is grounded in a dated official public-site snapshot, but it is not live inventory.
- Cancellation and QR flows demonstrate local experience behavior only. They do not perform provider actions.

## What is blocked

- Live ticket sales are blocked until approved provider APIs exist for inventory, holds, authoritative totals, payment, booking creation, and official ticket QR issuance.
- Provider cancellation and refunds are blocked until provider booking-management APIs are integrated.
- Live customer-care handover is blocked until an approved handover API and operational destination are available.
- Voice production governance is blocked on public ElevenLabs authentication or origin allowlisting and an approved retention policy.
- Full voice acceptance is blocked on human acoustic English and Arabic testing with audible output in a normal HTTPS browser.

## Required ElevenLabs changes

- Keep contract `2026-07-23.3` published and verify future changes by readback.
- Protect prompt SHA-256 `dc8d1af309c247a642c155e017e2b26b4caf1b3801c429f5f8a883ff5f3ca467`.
- Configure public authentication or an approved origin allowlist for production access.
- Define, approve, and document conversation and audio retention.
- Complete human English and Arabic acoustic acceptance, including recognition and audible responses.
- Preserve WebRTC voice, WebSocket text, EU residency, existing client-tool names, `select_seats`, fuzzy resolvers, explicit language routing, and shared state.

## Required API or knowledge-base changes

- Add licensed provider APIs for live sessions, sold-out status, seat inventory, and seat holds.
- Add authoritative checkout totals, fees, taxes, and payment authorization and capture.
- Add provider booking creation and official admission ticket QR issuance.
- Add provider booking lookup, cancellation, and refund processing.
- Add an approved customer-care handover endpoint and status feedback.
- Verify offers against official checkout before presenting an offer as applied or redeemable.
- Maintain sourced, dated knowledge for offers, cinema policies, ratings, accessibility, and other guest guidance.
- Keep explicit unavailable responses when current official knowledge is absent.

## Screenshots/logs/test evidence

- [Signed-in Chrome poster and compact movie-card rendering](./evidence/screenshots/final-hosted-signed-in-chrome-2026-07-23.png)
- [Hosted Arabic rating answer with the movie list retained](./evidence/screenshots/final-hosted-arabic-rating-2026-07-23.png)
- [Local validation evidence](./evidence/logs/final-local-validation-2026-07-23.md)
- [Hosted validation evidence](./evidence/logs/final-hosted-validation-2026-07-23.md)
- [End-to-end test report](./docs/end-to-end-test-report.md)
- [Production readiness report](./PRODUCTION_READINESS_REPORT.md)
- [Generated snapshot manifest](./src/generated/voxSnapshotManifest.js)
- [ElevenLabs contract](./config/elevenlabs-agent-contract.json)
- [ElevenLabs setup checklist](./ELEVENLABS_AGENT_SETUP.md)

Evidence confirms 23 of 23 local E2E tests, 1 of 1 hosted exact-commit smoke test, 23 of 23 hosted E2E tests, the live Chrome Arabic rating query with movie-list retention, and the 45-second controlled microphone-denial recovery with state retention.

## Final production readiness

Discovery, bilingual text journeys, booking preview, local journey continuity, hosted release parity, and controlled voice-error recovery: **READY FOR PRODUCTION.**

Acoustic English and Arabic voice recognition and audible output: **HUMAN ACCEPTANCE REQUIRED.**

Offers: **GUIDANCE ONLY, SUBJECT TO OFFICIAL CHECKOUT VERIFICATION.**

ElevenLabs public authentication or allowlisting and retention: **GOVERNANCE GATES.**

Live inventory, holds, payment, official ticket QR, provider cancellation, refunds, and handover: **BLOCKED BY MISSING APPROVED APIS.**
