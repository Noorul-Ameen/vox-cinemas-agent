# VOXi end-to-end validation report

Test date: 23 July 2026, UAE

Runtime and data source under test: `main` commit `4797e37c38e2d20ce7d7e7bf18d9898b78c89e79`

Production URL: <https://voxi-ai.pages.dev/>

Authoritative report: [FINAL_VALIDATION_REPORT_2026-07-23.md](../FINAL_VALIDATION_REPORT_2026-07-23.md)

## Release identity

Production `release.json` returned:

- Commit: `4797e37c38e2d20ce7d7e7bf18d9898b78c89e79`
- Snapshot: `20260723-08c005696287764d`

The hosted page loaded `/assets/index-CUILGygO.js`. The asset is 889,919 bytes and served with immutable caching.

## Data under test

- 10,388 sessions
- 35 films
- 22 cinemas
- 21 dates through 2026-08-12
- 817 sessions today
- 1,408 sessions tomorrow
- 320 schedule shards
- 83 official movie-information records

## Test results

| Suite | Result |
| --- | --- |
| Full local validators | PASS |
| Production build | PASS |
| Local E2E | 23/23 PASS |
| Hosted exact-commit smoke | 1/1 PASS |
| Hosted E2E | 23/23 PASS |
| Package audit | No known production vulnerabilities |
| Secret scan | Clean |
| Refresh VOX UAE showtimes run #13 | PASS in 2m41s, data commit published |
| Validate VOXi run #4 | PASS in 1m29s against the data commit |
| Warning-free Validate VOXi run #7 | PASS in 1m27s with no annotations |
| Hosted VOXi smoke run #7 | PASS in 45s |

## Workflow evidence

- Manual [Refresh VOX UAE showtimes run #13](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30008195281) succeeded in 2m41s and published data commit `4797e37c38e2d20ce7d7e7bf18d9898b78c89e79`.
- [Validate VOXi run #4](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30008628943) passed that data commit in 1m29s.
- This release upgrades both upload steps to `actions/upload-artifact` v7.0.1 pinned to its full commit SHA, removing the prior Node 20 artifact warning.
- [Validate VOXi run #7](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30009245035) passed without annotations in 1m27s.
- [Hosted VOXi smoke run #7](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30009356648) passed in 45s.

## Covered journeys

The local and hosted E2E suites cover:

- English and Arabic discovery
- Retained cinema, date, time, genre, language, experience, movie, and audience criteria
- Exact visible movie and showtime selection
- Grounded rating and child-suitability guidance
- Movie-information follow-up questions and explicit unknown handling
- No-result recovery without silent broadening
- Seat selection and seat-derived ticket count
- Checkout summary and return to seat editing
- FAQ detours with state restoration
- Device-local booking history and cancellation boundaries
- Text and voice journey-state continuity
- Customer-facing punctuation checks

## Live Chrome evidence

- Arabic rating query: PASS.
- Movie list remained visible after the Arabic rating response: PASS.
- Controlled microphone-denial recovery: PASS after 45 seconds.
- Active state remained after recovery: PASS.

The microphone-denial test proves bounded recovery and state retention. It does not prove acoustic recognition or audible output.

## ElevenLabs evidence

- Contract: `2026-07-23.3`
- Publication: PASS
- Dashboard readback: PASS
- Prompt SHA-256: `dc8d1af309c247a642c155e017e2b26b4caf1b3801c429f5f8a883ff5f3ca467`

Human normal-browser acceptance is still required for English and Arabic speech recognition and audible output. Public authentication or origin allowlisting and retention policy approval remain governance gates.

## External boundaries

No live APIs are present for:

- inventory
- seat holds
- payment
- official ticket QR
- provider cancellation
- provider refund
- customer-care handover

Offer guidance must be verified at official checkout before eligibility or redemption is treated as authoritative.

## Evidence links

- [Signed-in Chrome poster and compact movie-card rendering](../evidence/screenshots/final-hosted-signed-in-chrome-2026-07-23.png)
- [Hosted Arabic rating answer with the movie list retained](../evidence/screenshots/final-hosted-arabic-rating-2026-07-23.png)
- [Final validation report](../FINAL_VALIDATION_REPORT_2026-07-23.md)
- [Production readiness report](../PRODUCTION_READINESS_REPORT.md)
- [Local validation evidence](../evidence/logs/final-local-validation-2026-07-23.md)
- [Hosted validation evidence](../evidence/logs/final-hosted-validation-2026-07-23.md)
- [Generated snapshot manifest](../src/generated/voxSnapshotManifest.js)
- [ElevenLabs contract](../config/elevenlabs-agent-contract.json)
- [Refresh VOX UAE showtimes run #13](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30008195281)
- [Validate VOXi run #4](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30008628943)
- [Warning-free Validate VOXi run #7](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30009245035)
- [Hosted VOXi smoke run #7](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30009356648)

## Readiness decision

The deployed bilingual discovery and booking-preview experience passed its automated local and hosted E2E gates. Acoustic English and Arabic voice remains a human acceptance gate. Live ticket sales and provider servicing remain blocked until approved APIs are implemented and verified.
