# Annotated end-to-end validation

Test date: 16 July 2026, UAE

Test target: local production build at `http://127.0.0.1:4173/`

Viewport: 762 by 698 page with the protected 420 px Voxi widget

## Result

The supported local browsing and on-device booking-summary journeys are ready for leadership review. The final candidate passed the repository validation chain, production build budget, mounted English and Arabic browser journeys, and live ElevenLabs voice startup.

The product is not ready for public ticket sales. Provider-verified seat holds, payments, reservations, official admission tickets, cross-device booking lookup, cancellations, and refunds still require approved server APIs.

## Annotation findings and fixes

| Finding | Root cause | Final result |
| --- | --- | --- |
| The agent claimed movies were displayed while the cinema picker was visible | Movie-result claims were not checked against the `cinemas` stage | Fixed. The transcript now asks for the cinema and the picker remains authoritative. |
| DCC did not reliably select City Centre Deira | The short ASR alias was missing from local resolution and agent normalization | Fixed for text and voice-event routing. |
| Full cinema and movie lists crowded the active conversation | All 22 cinemas and all matching films rendered at once | Fixed. The picker shows six cinemas plus View all, and movie results show four compact horizontal cards plus Show all. Search and every result remain available. |
| Earlier chat was difficult to review | The complete transcript always occupied the rich-panel viewport | Fixed. Rich stages show the latest four messages, empty state shows eight, and an accessible control expands the complete ordered history. |
| Checkout seat-edit requests were refused or lost | Natural edit wording was left to the remote agent instead of local state routing | Fixed for Edit seats, change seats, polite variants, add or remove wording, seat labels, seat targets, Back, English, Arabic, text, and voice-event paths. |
| Checkout or saved summaries were described as confirmed bookings | Pending checkout and on-device summary states were not strongly distinguished | Fixed. Pending checkout, selected seats, totals, reference QR, saved summary, and cancelled summary claims are guarded against the authoritative stage. |
| Payment completion could produce two messages | A deterministic system outcome was followed by a hidden agent turn | Fixed. Completion now produces one saved-summary notice and one booking card. |
| A stale checkout completion could leave payment navigation locked | Two stale completion branches returned without releasing the payment lock | Fixed with an explicit no-charge recovery path. |
| Family requests could silently retain the KIDS cinema experience after switching to action | Dynamic experience matching interpreted ordinary kids and family wording as a format | Fixed. Kids and family is an audience preference unless the guest explicitly asks for the KIDS experience. |
| `Cancel a booking` could start movie discovery | The cancellation action matcher did not accept the article `a` | Fixed. Generic cancellation now opens current bookings. |
| A new cancellation from a cancelled summary reused the cancelled record | Both cancellation routing layers treated any visible summary as the target | Fixed. Only a current visible booking is used without an exact reference. |
| Typing a movie title during cancellation could leave the cancellation flow | Target selection was not kept authoritative for all continuation cases | Fixed. A unique displayed title opens confirmation. Duplicate titles stay in Current bookings and request the displayed reference. |
| Device-only cancellation produced duplicate completion responses | The UI click added a system notice and then elicited an agent reply | Fixed. The deterministic no-refund notice is the only completion response. |
| A model response repeated its opening phrase | A duplicated leading segment could reach the transcript | Fixed with runtime response normalization and a prompt rule against repeated openings. |

## Mounted browser evidence

| Scenario | Result | Evidence |
| --- | --- | --- |
| `What's showing tonight?` without a cinema | PASS | Cinema picker shown, no movie claim, six initial venues, View all 22 cinemas. |
| `DCC` after the cinema question | PASS | City Centre Deira selected and current movie cards rendered. |
| Mall of the Emirates, tomorrow, 6 PM in one turn | PASS | Cinema, 17 July, and 18:00 retained. Only exact or nearby sessions rendered. |
| No exact requested time | PASS | The UI stated that no exact time existed and showed the closest suitable times. |
| Kids and family, then action instead | PASS | The family audience constraint was replaced. Action results were not restricted to KIDS. |
| Specific movie plus IMAX | PASS | Only The Odyssey rendered with its IMAX sessions. |
| Ticket target | PASS | `I need three tickets` displayed a target of three without a quantity selector. |
| Seat-derived count and price | PASS | E1, E3, and E4 produced 3 seats and AED 126. Removing E4 produced 2 seats and AED 84. |
| Seat confirmation | PASS | Checkout replaced the seat map and stated that the booking was not confirmed. |
| FAQ during checkout | PASS | The policy answer appeared while the exact checkout remained visible. |
| Checkout seat editing | PASS | `Make seat to 2` returned to the same map with existing seats. Arabic `أريد تغيير المقاعد` did the same. |
| Checkout completion | PASS | Exactly one saved-summary notice rendered. It stated no charge and no reservation, then showed the saved card and reference QR. |
| Reload persistence | PASS | The new summary remained in Booking history after reload. |
| Cancellation by unique movie title | PASS | The title continued cancellation and opened the correct confirmation card. |
| Duplicate movie title cancellation | PASS | The selector remained visible and requested the displayed reference instead of guessing. |
| Cancellation decline | PASS | Keep booking removed the prompt and retained Saved status. |
| Device-only cancellation | PASS | The record changed to Cancelled and stated that no refund was processed. |
| Arabic discovery | PASS | Arabic UI and response retained Mall of the Emirates, tomorrow, and Arabic-language filtering. |
| Live voice startup | PASS | Voice chat connected with the configured agent, microphone access produced a live transcript event, and End voice returned to Text chat with the stage intact. |
| Text inside an active voice session | PASS | The FAQ response used the same active journey without replacing movie results. |
| 420 px layout | PASS | Widget width was 420 px. Main client width equalled scroll width. Compact poster measured 56 by 80 px and loaded successfully. |
| Arabic RTL layout | PASS | Direction was RTL, widget width was 420 px, and the main panel had no horizontal overflow. |
| Browser Back and Forward | PARTIAL | Browser Back left the standalone page, and Forward reloaded it safely. Transient conversation state is intentionally not stored in browser history. In-widget Back, checkout Edit seats, history Back, and return controls passed. |

## Automated validation

Commands:

- `pnpm run validate`
- `pnpm run build`
- `pnpm run validate:annotated-journeys`

Validated areas include extraction, 22 cinemas, 36 films, 10,567 sessions, 18 published dates, on-demand shards, discovery filters, nearest times, seat routing, quote races, checkout continuity, booking persistence, cancellation safety, offers, FAQ, language switching, transport recovery, voice startup, unified rendering, punctuation, and daily refresh integrity.

The final production build passed the cold-load gate with one initial application script, 205,329 gzip bytes, 266 schedule shards, and a largest shard of 54,902 raw bytes.

## What works

- Progressive requirement collection without re-asking supplied cinema, date, time, genre, language, experience, movie, or audience.
- Filtered current schedule discovery and nearest-time fallback.
- Compact poster cards with source fallback behavior.
- Text-first interaction without microphone dependency.
- English and Arabic interface and conversation control.
- Live ElevenLabs text and WebRTC voice startup with EU residency preserved.
- Seat selection, seat-derived count, quote, checkout editing, and checkout continuity.
- On-device booking-summary persistence, reference QR, history, and device-only cancellation.
- FAQ continuity during discovery, seats, checkout, and booking review.

## Partially working

- Spoken English and Arabic booking logic shares the tested voice-event routing and the live microphone connected, but deterministic audio injection is not available in this browser harness. A final physical spoken replay should still be performed in the leadership browser.
- Browser Back and Forward safely leave and restore the standalone document, but they do not restore transient rich-stage history. Use the in-widget navigation controls.
- Schedule freshness depends on the configured extraction and deployment workflow until the official cinema API is enabled.
- The reference QR identifies the saved device summary. It is not an official admission ticket.

## What does not work

- Real payment authorization or capture.
- Provider-verified seat holds and authoritative final pricing.
- Official VOX reservation creation or admission QR.
- Cross-device booking lookup.
- Provider cancellation, refund, and reconciliation.
- Human support connection from the local summary panel.

## Blocked outside the repository

- Provider credentials and approved server gateway.
- PCI-compliant payment integration.
- Official booking, ticket, cancellation, and refund contracts.
- Operations and legal approval for mutable FAQ and offer content.
- Deterministic physical microphone replay in both languages.
- Deployment of this exact local candidate to Cloudflare. No push or deployment was performed in this task.

## Required ElevenLabs changes

1. Copy the current rules from `src/lib/voxiSession.js` into the dashboard agent prompt.
2. Keep the configured agent ID, client-tool names, `select_seats`, and `serverLocation: "eu-residency"` unchanged.
3. Keep the continuation first-message variable so transport changes do not replay the welcome.
4. Include the pending-checkout seat-edit rule, saved-summary transaction boundary, cancellation title selection, response non-repetition, and punctuation rule in the dashboard prompt.
5. Complete one controlled English and one controlled Arabic spoken journey in the final Chrome review environment.

The rendered transcript guard runs after the remote reply is generated. Therefore, dashboard prompt parity remains required for the audible response itself.

## Required API and knowledge-base changes

- Add server-side movie, session, seat-plan, hold-token, quote, payment, booking, ticket, lookup, cancellation, refund, and reconciliation adapters.
- Keep upstream secrets on the server and never expose them through Vite environment variables.
- Add content ownership, approval date, effective date, and review cadence for refund, accessibility, ratings, offers, and support answers.
- Define a live-data fallback contract that never invents availability, price, eligibility, or transaction status.

## Evidence

- [Compact filtered movie result](../screenshots/annotated-e2e-movie-filter-2026-07-16.png)
- [Arabic RTL result](../screenshots/annotated-e2e-arabic-2026-07-16.png)
- [Cold-load remediation](cold-start-remediation-2026-07-16.md)
- [Checkout continuity](checkout-continuity-2026-07-16.md)
- [Cancellation performance fix](cancellation-performance-fix-2026-07-16.md)

## Final production-readiness status

| Scope | Status | Decision |
| --- | --- | --- |
| Leadership review of the local candidate | READY | The supported browsing, seat, checkout-review, saved-summary, cancellation, language, layout, and voice-start journeys passed. |
| Cloudflare review of these exact changes | PENDING | The final candidate has not been pushed or deployed in this task. |
| Public browsing on refreshed snapshot data | PARTIAL | Functional while the refresh and deployment workflow remains healthy. |
| Public ticket sales and customer service | BLOCKED | Live provider and payment integrations are required. |
