# VOXi production readiness report

Date: 23 July 2026, UAE

Production: <https://voxi-ai.pages.dev/>

## Decision

VOXi is ready for production as a bilingual cinema discovery and booking-preview experience. It is not ready to sell or manage official tickets.

The validated runtime source is `main` commit `1af1d1908545483ff9659288fc645fac7fdda6d9`. Its functional test deployment reported that exact commit and snapshot `20260723-180b0b07f8429acf`. Production `release.json` is the source of truth for the current deployment commit after documentation-only updates.

## Verified release

- Hosted asset: `/assets/index-DqBCeyow.js`
- Hosted asset size: 889,938 bytes
- Cache policy: immutable
- Full local validators: PASS
- Production build: PASS
- Local E2E: 23/23 PASS
- Hosted exact-commit smoke: 1/1 PASS
- Hosted E2E: 23/23 PASS
- Package audit: no known production vulnerabilities
- Secret scan: clean

## Verified data

- Sessions: 10,606
- Films: 35
- Cinemas: 22
- Dates: 21, from 2026-07-23 through 2026-08-12
- Sessions today: 1,116
- Sessions tomorrow: 1,398
- Schedule shards: 320
- Official movie-information records: 83

## Functional readiness

Ready:

- English and Arabic text discovery
- Retained cinema, date, movie, time, language, genre, experience, and audience criteria
- Grounded rating and movie-information responses
- Exact movie and showtime selection
- Seat selection and seat-derived ticket count
- Booking summary and payment preview
- FAQ continuity and return to checkout
- Device-local history and clearly disclosed local cancellation
- Live Chrome Arabic rating query, with the movie list retained
- Controlled Chrome microphone-denial recovery after 45 seconds, with state retained

Partially ready:

- ElevenLabs contract `2026-07-23.3` is published and read back.
- Prompt SHA-256 is `dc8d1af309c247a642c155e017e2b26b4caf1b3801c429f5f8a883ff5f3ca467`.
- Automated voice contracts and recovery pass.
- Acoustic English and Arabic speech recognition and audible output remain a human normal-browser acceptance gate.
- Offer content is guidance and requires official checkout verification.

Not available:

- Live inventory
- Seat holds
- Payment authorization or capture
- Official booking and ticket QR
- Provider cancellation and refund
- Live customer-care handover

## Governance gates

- Configure public ElevenLabs authentication or an approved origin allowlist.
- Approve and document conversation and audio retention.
- Record human normal-browser acceptance for English and Arabic speech recognition and audible output.
- Complete security and operational review for any future provider credentials and transaction gateway.

## Required integrations

- Live schedule and seat-inventory API
- Seat-hold lifecycle API
- Authoritative totals, fees, taxes, and offer application
- Payment authorization and capture
- Provider booking creation and official admission QR
- Provider lookup, cancellation, and refund
- Customer-care handover with delivery status
- Official offer verification at checkout

## Evidence

- [Final validation report](./FINAL_VALIDATION_REPORT_2026-07-23.md)
- [End-to-end test report](./docs/end-to-end-test-report.md)
- [Local validation evidence](./evidence/logs/final-local-validation-2026-07-23.md)
- [Hosted validation evidence](./evidence/logs/final-hosted-validation-2026-07-23.md)

## Final status

- Discovery and booking preview: **READY**
- Hosted release identity and parity: **PASS**
- Acoustic English and Arabic voice: **HUMAN ACCEPTANCE REQUIRED**
- ElevenLabs authentication, allowlisting, and retention: **GOVERNANCE GATES**
- Offers: **OFFICIAL CHECKOUT VERIFICATION REQUIRED**
- Live ticket transactions and provider servicing: **BLOCKED**
