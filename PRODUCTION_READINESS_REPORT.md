# VOXi production readiness summary

Test date: 16 July 2026, UAE

Cloudflare URL: <https://voxi-ai.pages.dev/>

StackBlitz URL: <https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

Branch: `main`

Tested application commit: `4ab7b23dc96ba461b8d1d411177892f36b4b66e6`

Deployed asset: `/assets/index-CSAd90cI.js`

Asset identity: 4,744,533 bytes, SHA-256 `E68AB19B95D15F205DB1F524AAF131331B352EF2D4055A3E28F2E382A1C4EF72`

## Decision

| Scope | Status | Decision |
| --- | --- | --- |
| Leadership review using text, touch, current schedule discovery, seat flow, checkout preview, booking summary, and device-only cancellation | PARTIALLY WORKING | The tested text journey is complete, but actual spoken voice remains blocked by the automated Chrome microphone permission state. |
| Customer production sales | BLOCKED | Licensed live inventory, seat holds, authoritative prices, payment, official tickets and QR, cross-device booking lookup, cancellation, and refund APIs are not enabled. |
| Repository validation | PASS | All 26 validators, the production build, converter validation, punctuation validation, and hosted asset parity passed. |

## Current data

- Extracted at `2026-07-15T22:38:00.344Z`.
- Official VOX UAE public-site snapshot.
- 9,972 sessions, 35 films, 22 cinemas, and 11 dates from 16 to 26 July 2026.
- 1,450 sessions today and 1,449 sessions tomorrow at test time.
- Daily 05:30 UAE refresh and Thursday 10:30 UAE supplementary refresh are configured.

## Main results

- Cloudflare showtime rendering, exact and nearest-time filtering, specific movie, genre, kids, experience, and Arabic language filtering passed.
- The Arabic request `ما هي الأفلام العربية في مول الإمارات غداً؟` retained Mall of the Emirates, 17 July, and Arabic, and did not create an unresolved movie title.
- Seat count, total, fees, and checkout are derived only from selected seats.
- Checkout back-navigation, seat replacement, and natural `Go back to the seats` navigation passed.
- FAQ answers appear in the transcript while the seat map remains visible.
- Booking summary, reference QR, history persistence, and truthful device-only cancellation passed.
- Static repository text, agent prompt, bilingual UI, FAQ, fallback text, transcript output, provider data, and dynamic rich UI error fields passed the Unicode dash prohibition.
- The prior generic Cloudflare error was not reproduced on the final asset. A real today-omission refresh defect was found and fixed. The exact historical failure cannot be claimed as conclusively reproduced.
- Hosted voice startup reached the bounded microphone wait and then returned to text with state preserved. The browser console recorded `Microphone permission timed out`. Actual spoken voice remains blocked for manual browser and ElevenLabs verification.

The full scenario matrix, official data samples, evidence, dependencies, and risk assessment are in [docs/end-to-end-test-report.md](./docs/end-to-end-test-report.md).
