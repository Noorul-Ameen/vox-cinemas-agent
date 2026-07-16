# VOXi production readiness summary

Test date: 16 July 2026, UAE

Cloudflare URL: <https://voxi-ai.pages.dev/>

StackBlitz URL: <https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

Branch: `main`

Tested application commit: `4ab7b23dc96ba461b8d1d411177892f36b4b66e6`

Deployed asset: `/assets/index-CSAd90cI.js`

Asset identity: 4,744,533 bytes, SHA-256 `E68AB19B95D15F205DB1F524AAF131331B352EF2D4055A3E28F2E382A1C4EF72`

## Cold-start remediation candidate

Status: PASS locally, pending push and Cloudflare deployment.

- The leadership landing page now renders a branded VOX loading shell directly from HTML.
- The complete 10,567-session schedule is no longer included in startup JavaScript.
- The initial JavaScript is 693,972 bytes raw, 196,789 bytes gzip, and 179,727 bytes Brotli quality 5.
- The currently deployed baseline is 4,905,829 bytes raw and 487,894 bytes gzip.
- Initial JavaScript is reduced by 85.9 percent raw and 59.7 percent gzip.
- Exactly one application script is requested before interaction.
- The unchanged ElevenLabs transport loads only when text or voice starts.
- Showtimes are stored in 266 content-versioned cinema and date shards. The largest shard is 54,902 bytes raw and 2,244 bytes gzip.
- A fresh cinema and date shard rendered in 351 ms in the mounted production preview. A cached date rendered in 291 ms.
- The 420 px browser inspection found no horizontal overflow, all three displayed posters loaded at 104 by 156 px, and no browser console errors or warnings were recorded.
- Daily refresh now generates and validates the compact catalog and versioned shards together with the full source extraction.
- Automated production-build budgets fail if the startup bundle, request count, shard size, cache policy, branded shell, or ElevenLabs deferral regresses.

Evidence: [cold-start remediation log](./evidence/logs/cold-start-remediation-2026-07-16.md).

## Checkout continuity candidate

Status: PASS locally, pending leadership review before push.

- FAQ and general questions no longer displace an unpaid checkout.
- Offers, repeated offer refinement, booking history, booking details, and cancellation review keep the checkout resumable.
- A persistent English and Arabic return action restores the exact checkout ID, movie, showtime, seats, and total.
- Typed and voice transcript paths recognize checkout return wording before discovery routing.
- Agent movie, showtime, seat, and summary tools cannot silently replace an active checkout.
- Payment authorization cannot be unmounted by a competing panel transition.
- Edit seats restored D5 and D6, removing D6 recalculated the order from two tickets at AED 84.00 to one ticket at AED 42.00, and reconfirming rendered the updated checkout.
- Local Arabic voice startup reached Voice chat and returned safely to Text chat after ending the session.
- Checkout completion rendered the saved booking summary and reference QR.
- The 420 by 850 inspection found no horizontal overflow and no browser errors.

Evidence: [checkout continuity validation](./evidence/logs/checkout-continuity-2026-07-16.md).

## Annotated leadership validation addendum

Status: READY locally for leadership review, pending push and Cloudflare deployment.

- The exact cinema-picker, DCC, transcript-history, checkout seat-edit, and saved-summary contradictions from the browser annotations are fixed.
- Cinema and movie selection now use compact progressive disclosure while preserving search and every result.
- Mounted browser testing found and fixed family-to-action preference leakage and two cancellation escape paths that source-only checks had missed.
- Seat count and price changed from three seats at AED 126.00 to two seats at AED 84.00 after checkout editing.
- FAQ, English and Arabic seat editing, one-message saved-summary completion, persistence, movie-title cancellation, duplicate-title safety, and no-refund cancellation passed.
- Live voice startup reached Voice chat, produced a microphone transcript event, and returned to Text chat with the active task preserved.
- The widget measured 420 px with no horizontal overflow. Compact posters loaded at 56 by 80 px.
- Public ticket sales remain blocked on provider seat-hold, payment, booking, ticket, cancellation, and refund APIs.

Full evidence: [annotated end-to-end validation](./evidence/logs/annotated-end-to-end-validation-2026-07-16.md).

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
