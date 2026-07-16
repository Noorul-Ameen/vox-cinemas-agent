# VOXi end-to-end validation report

## Test basis

| Item | Value |
| --- | --- |
| Test date | 16 July 2026, UAE |
| Cloudflare URL | <https://voxi-ai.pages.dev/> |
| Repository | `Noorul-Ameen/vox-cinemas-agent` |
| Branch | `main` |
| Tested application commit | `4ab7b23dc96ba461b8d1d411177892f36b4b66e6` |
| Cloudflare bundle | `/assets/index-CSAd90cI.js` |
| Bundle bytes | 4,744,533 |
| Bundle SHA-256 | `E68AB19B95D15F205DB1F524AAF131331B352EF2D4055A3E28F2E382A1C4EF72` |
| Data extraction | `2026-07-15T22:38:00.344Z` |
| Desktop coverage | Signed-in Chrome, 1440 by 1000 |
| Responsive coverage | Codex in-app browser, 420 by 900 |
| Local coverage | Vite development server and production build |

The Cloudflare JavaScript was downloaded and compared with the local production bundle. Byte count and SHA-256 matched exactly. The root document used no-store behavior and the hashed JavaScript asset used immutable caching.

## Executive assessment

| Scope | Status | Assessment |
| --- | --- | --- |
| Leadership review | PARTIALLY WORKING | The complete text and touch journey, current schedule discovery, filtering, seat flow, checkout preview, booking summary, reference QR, and device-only cancellation passed. Actual spoken voice remains blocked. |
| Customer production sales | BLOCKED | Live inventory, holds, authoritative pricing, payment, official ticket QR, cross-device lookup, cancellation, and refund gateways are not connected. |
| Repository quality gates | PASS | All 26 validators, production build, converter validation, punctuation checks, secret-pattern scan, and hosted asset parity passed. |

No repository-level FAIL remains in the tested text journey. External and environment-dependent gaps are listed as BLOCKED, PARTIALLY WORKING, or NOT TESTED.

## Showtime error investigation and completed fixes

The previously reported generic Cloudflare showtime error could not be reproduced on the final hosted asset. The current production site uses the bundled validated VOX snapshot because `VITE_VISTA_BASE` is unset. It does not make a browser-side live Vista request, so CORS, provider authentication headers, and Cloudflare proxy rewrites were not the cause of the final deployment behavior.

A concrete freshness defect was found: the daily extractor defaulted to tomorrow. After a refresh, the current UAE date could disappear even while the official source still published sessions for that date. The extractor now starts on the current UAE date, and the freshness gate requires both today and tomorrow to have sessions.

Additional fixes completed during this validation:

- Showtime errors now retain scoped error detail, console context, and a retry path instead of leaving a generic dead state.
- Past sessions are filtered using UAE time and a 06:00 programming-day cutoff.
- The Arabic generic movie question no longer becomes an unresolved title.
- Dynamic pricing, cancellation, movie, showtime, notice, loading, and question strings pass through the customer-facing punctuation boundary.
- FAQ answers render in the transcript while the active rich booking stage remains visible.
- `Continue` after an FAQ interruption preserves the booking stage.
- The seat map is replaced by checkout after seat confirmation, and the booking summary displays the selected seats and reference QR.
- Previously verified official media is retained only when the new source response is clearly partial.

Because the exact historical generic failure was not reproduced before the fix, this report does not claim that the today-omission defect was the sole cause of every past screenshot.

## Data source and freshness

| Property | Current behavior |
| --- | --- |
| Schedule source | Official VOX UAE public-site routes under `uae.voxcinemas.com` and `uae-apife.voxcinemas.com` |
| Runtime mode | Validated bundled snapshot |
| Live provider writes | Disabled |
| Extraction start | Current date in `Asia/Dubai` |
| Date discovery | Official advertised `availableDays`, capped at 31 days |
| Current coverage | 16 to 26 July 2026 |
| Sessions | 10,010 raw, 9,972 unique, 38 duplicates removed |
| Catalog | 35 films and 22 cinemas |
| Today and tomorrow | 1,450 sessions on 16 July, 1,449 on 17 July |
| Browser cache | Root no-store, hashed asset immutable |
| Data refresh | Daily at 05:30 UAE, plus Thursday at 10:30 UAE, and manual dispatch |
| Past-session filtering | UAE clock with a 06:00 programming-day cutoff |
| Sold-out detection | Not authoritative in snapshot mode |
| Checkout revalidation | No licensed inventory hold or provider quote is available |

The widget does not substitute a stale date when the requested date is not covered. It shows an explicit unavailable state. Snapshot seat availability is labelled as a preview. Final availability and pricing require the licensed booking gateway.

## Official source comparison samples

The values below were taken from the current official extraction and checked against the concierge mapping.

| Movie | Cinema and date | Official sample | Concierge result | Status |
| --- | --- | --- | --- | --- |
| Toy Story 5 | Mall of the Emirates, 17 July | 19 sessions, English, official poster. Session `619806` at 17:45 KIDS and `619657` at 18:30 PREMIER. | Exact 18:00 request clearly stated no exact match and showed only 17:45 and 18:30. | PASS |
| The Odyssey | Mall of the Emirates, 17 July | 51 sessions, English, official poster. IMAX sessions `619116`, `619117`, `619118` at 09:00, 12:30, 16:00. 4DX sessions `619154`, `619155`, `619156` at 10:15, 13:45, 17:15. | IMAX showed only the IMAX times. Changing to 4DX replaced them with the 4DX times. | PASS |
| Supergirl | Yas Mall Abu Dhabi, 17 July | Two PREMIER sessions, `531556` at 13:40 and `531559` at 20:50, English, official poster. | Cinema, date, and language mapping matched the snapshot. | PASS |
| Ezma | Mall of the Emirates, 16 July | One limited session, `619699` at 15:45 PREMIER, Arabic, official poster. | Arabic and limited-showtime mapping matched. | PASS |
| Sakr w Canaria | Mall of the Emirates, 16 July | Sessions `619552`, `619554`, `619556` at 14:00, 19:00, and 00:00 PREMIER, Arabic, official poster. | Arabic results retained all three programming-day sessions. | PASS |
| The Match: FIFA WC Documentary | Mall of the Emirates, 16 July | One session, `619700` at 18:10 PREMIER, Spanish and English, official poster. | Limited-session mapping matched. | PASS |
| Jana Nayagan | City Centre Deira, 22 July | Tamil, sessions `664534` and `664536` at 04:30, poster missing from the official source. | Session data is present. UI uses an explicit neutral fallback and records `missing_at_source`. | PARTIALLY WORKING |

No authoritative sold-out sample was available in the snapshot payload. Sold-out validation is therefore not claimed.

## Complete scenario matrix

| Area | Test Scenario | Status | Expected Result | Actual Result | Fix Applied | Remaining Dependency |
| --- | --- | --- | --- | --- | --- | --- |
| Deployment | Cloudflare asset matches local build | PASS | Same production bytes | Byte count and SHA-256 matched | Verified exact artifact | None |
| Deployment | Prior generic showtime error reproduction | NOT TESTED | Reproduce the exact original state | Final and earlier inspected builds did not reproduce the exact generic state | Concrete freshness defect and error path fixed | Original failing network trace was unavailable |
| Showtime | Current UAE date remains after refresh | PASS | Today and tomorrow are available | 1,450 today and 1,449 tomorrow | Extractor starts on UAE today and freshness validator checks both | Official source availability |
| Showtime | Structured loading and retry behavior | PARTIALLY WORKING | Scoped error, retry, and console context | Source and local error paths passed. Hosted normal loading passed, but a hosted provider failure was not deliberately injected. | Added structured error metadata and retry | Hosted live-gateway failure replay |
| Data | Current schedule coverage | PASS | Current official advertised dates | 9,972 sessions across 11 dates | Transactional extraction and validation | Daily source access |
| Data | Exact title, cinema, date, format, language, and session IDs | PASS | Mappings agree with source | Sample matrix agreed | Source IDs and fields preserved | None for snapshot mapping |
| Data | Limited-showtime movies | PASS | Single and low-count sessions remain visible | Ezma, Supergirl, and Match samples retained | No broad minimum-session filter | None |
| Data | Official poster display | PASS | Contained official posters render | Toy Story, Arabic catalog, and confirmation poster loaded at 420 px | Poster retention and load evidence | Remote host availability |
| Data | Jana Nayagan poster | PARTIALLY WORKING | Official poster or truthful fallback | Official source omitted the poster, fallback rendered | Added explicit missing-source metadata | VOX source poster |
| Data | Experience artwork refresh | PARTIALLY WORKING | Complete current official set | One fresh record plus 13 previously verified official records retained because the current response was partial | Partial-response guard | Complete official response |
| Data | Offer imagery refresh | PASS | Current official offer records | 21 fresh records, no retained stale records | Campaign-aware refresh | Official offer pages |
| Data | Authoritative sold-out sessions | BLOCKED | Sold-out status matches provider | Snapshot status does not provide reliable sold-out inventory | UI labels availability as preview | Licensed inventory API |
| Automation | Daily refresh configuration | PASS | Automated daily current data | Daily and Thursday schedules configured | Today-first transactional refresh | GitHub and source availability |
| Automation | Observe next natural scheduled run and alert path | NOT TESTED | Scheduled run completes after this report | Configuration and prior manual paths validated, next natural run not observed | Workflow includes validation gates | Time and external runner state |
| Discovery | Cinema already provided | PASS | Do not ask for cinema again | Mall of the Emirates retained | Persistent criteria parser | None |
| Discovery | Date already provided | PASS | Do not ask for date again | Tomorrow became 17 July | UAE date parser | None |
| Discovery | Preferred time supplied | PASS | Filter to exact or nearby sessions | 18:00 returned only 17:45 and 18:30 for Toy Story | Nearest-time result window | None |
| Discovery | Specific movie filtering | PASS | Do not show unrelated movies | Toy Story query returned only Toy Story | Specific-title grounding | None |
| Discovery | Genre filtering | PASS | Only matching catalog movies | Comedy results excluded The Odyssey | Genre metadata filter | Source metadata quality |
| Discovery | Kids and family filtering | PASS | Only suitable movies or KIDS sessions | Minions, Toy Story, and Supergirl matched, The Odyssey did not | Audience and KIDS-session filter | Source classifications |
| Discovery | Experience filtering | PASS | Only matching experience sessions | IMAX showed the three IMAX times | Experience-session filter | None |
| Discovery | Change experience | PASS | Replace stale experience results | 4DX replaced IMAX with 10:15, 13:45, 17:15 | Preference invalidation | None |
| Discovery | Arabic language, cinema, and date request | PASS | Arabic movies at Mall of the Emirates tomorrow | Four Arabic films rendered, Toy Story did not, no unresolved-title error | Arabic generic-question guard and regression test | None |
| Discovery | Text and voice transcript parsing parity | PASS | Same transcript produces same criteria | Deterministic tests passed | Shared parser and journey reducer | Actual microphone transport separate |
| Booking | Ticket count derives from seats | PASS | One seat equals one ticket | A2 and A3 produced two seats and AED 84.00 | Removed quantity flow, seat-derived totals | Live pricing gateway |
| Booking | Return from checkout and change seats | PASS | New seats replace stale checkout | A2 and A3 changed to A2 and A4, total remained two seats and AED 84.00 | Back-navigation and quote refresh | Live price quote |
| Booking | Natural back to seats | PASS | Text command returns to seat map | `Go back to the seats` restored seat map with A2 and A4 | Shared navigation intent | Voice replay blocked |
| Booking | Change showtime clears seat and checkout | PASS | Earlier selection invalidates downstream state | Showtime panel returned and seat map and checkout were removed | Selection invalidation graph | None |
| Navigation | Browser Back and Forward history buttons | NOT TESTED | Browser history preserves or safely resets the journey | Separate browser Back and Forward controls were not replayed after the final deployment. In-app Back and natural navigation passed. | None | Dedicated browser-history replay |
| Booking | Payment confirmation rendering | PASS | Checkout leaves seat map and shows final summary | Booking summary showed A2 and A4, AED 84.00, poster, reference, and QR | Unified confirmation stage | Real payment and reservation APIs |
| Booking | Booking history persistence | PASS | Saved record remains on device | Record appeared in history | Versioned local storage | Cross-device booking API |
| Cancellation | Current booking cancellation | PASS | Truthful confirmation and cleanup | Device-only warning displayed, record marked cancelled, action and QR removed | Deterministic cancellation routing and storage | Provider cancellation and refund API |
| Transaction | Real payment, reservation, official ticket QR | BLOCKED | Provider confirms a paid reservation | Current flow is explicitly a payment preview and reference QR | Honest capability boundaries | PCI payment, inventory hold, booking and ticket APIs |
| Transaction | Real cancellation and refund | BLOCKED | Provider verifies eligibility and refund outcome | Current action changes only the device-local record | Two-step truthful confirmation | Provider cancellation and refund APIs |
| FAQ | Refund question during seat selection | PASS | Answer in transcript, stage preserved, no duplicate panel | Refund answer appeared and seat map stayed visible | Inline FAQ response | Production content approval |
| FAQ | Continue after FAQ | PASS | Resume same stage | Seat map remained active and discovery did not restart | Resume-only context routing | None |
| Conversation | Internal readiness lines | PASS | No customer-facing `Text is ready` message | No readiness transcript line rendered | Removed readiness transcript copy | None |
| Conversation | End and start new conversation | PASS | Clear logical journey without stale rich stage | Repeated hosted resets returned to the welcome state | Unified reset lifecycle | None |
| Voice | Protected source and transport contract | PASS | WebRTC, EU residency, tool names, worklets, and timeouts remain valid | All source validators passed | No protected contract changed | ElevenLabs service availability |
| Voice | Actual hosted microphone and spoken reply | BLOCKED | Voice connects and continues current journey | Chrome permission remained pending, then `Microphone permission timed out`; text state remained intact | Bounded timeout and graceful fallback | Chrome permission state and ElevenLabs session verification |
| Visual | Desktop layout | PASS | Centered, contained, readable widget | 1440 by 1000 inspection passed | White and blue compact layout | None |
| Visual | 420 px English and Arabic layout | PASS | No document overflow, compact posters, fixed composer | 420 by 900 screenshots passed in LTR and RTL | Responsive grid and compact media | Physical device check remains separate |
| Visual | Physical phone and tablet | NOT TESTED | Real-device input, keyboard, and rotation pass | No physical device was attached | 420 px browser coverage completed | Device lab |
| Accessibility | Keyboard and semantic control contracts | PASS | Buttons, labels, status, alerts, and focus paths are present | Automated contracts and browser interaction passed | Accessible names and state labels | Screen-reader audit separate |
| Accessibility | Screen reader and contrast audit | NOT TESTED | Formal WCAG review | Not executed | None | Accessibility specialist and device tools |
| Punctuation | No Unicode em dash or en dash in customer-facing content | PASS | Forbidden characters never render | 96 repository text files, bilingual strings, FAQ, prompts, fallbacks, transcripts, provider fields, and dynamic errors passed | Static scan and runtime normalization | Re-run on every change |
| Security | Real secret exclusion | PASS | No real secrets committed | Only `.env.example` found, secret-pattern scan found no credential value, ignore rules cover local secrets and key files | Existing repository rules | Full third-party security review |
| Dependencies | Package vulnerability audit | NOT TESTED | Lockfile audit result | `pnpm audit` could not run because the project uses `package-lock.json` and no pnpm lockfile; npm CLI was not available in this runtime | None | Run `npm audit --omit=dev` in CI |
| Performance | JavaScript bundle size | PARTIALLY WORKING | Production load budget is defined and met | Build passed, but the bundle is 4,744,533 bytes and Vite emitted a chunk-size warning | None in this scope | Code splitting, performance budget, Lighthouse testing |

## What works

- Current official schedule discovery for covered dates.
- Specific movie, cinema, date, time, genre, kids, language, and experience filtering.
- Exact and nearest-time behavior.
- English and Arabic text interaction.
- Inline FAQ interruption and stage preservation.
- Seat-derived ticket count, total, fees, and checkout summary.
- Checkout back-navigation, seat replacement, and natural navigation commands.
- Booking summary, compact posters, reference QR, local history, and device-only cancellation.
- Desktop and 420 px responsive rendering.
- Automated data refresh configuration and transactional validation.
- Customer-facing punctuation compliance.

## What does not work as a live customer transaction

- Real seat inventory and holds.
- Authoritative provider prices and fees.
- Real payment authorization.
- Official VOX booking creation and admission QR.
- Cross-device booking lookup.
- Provider cancellation, refund, and offer redemption.

These paths are intentionally not simulated as live.

## Partially working

- Leadership review is partially working because actual spoken voice is blocked in the current automated Chrome permission state.
- Experience-media refresh is partially working because the official response was partial and 13 previously verified records were retained.
- Jana Nayagan uses a truthful poster fallback because the official source omitted its poster.
- Performance is partially working because the production build passes but the large single bundle has no agreed performance budget.

## Blocked items and exact actions

### ElevenLabs

1. Confirm the dashboard agent uses the same public agent ID as the deployment.
2. Keep WebRTC and `serverLocation: "eu-residency"` unchanged.
3. Keep all existing client-tool names and `select_seats` unchanged.
4. Synchronize the dashboard prompt with `src/lib/voxiSession.js`, including the no-Unicode-dash rule and the current bilingual journey guidance.
5. Configure the dashboard first message as `{{voxi_session_opening}}` so text-to-voice continuation does not replay the welcome.
6. Confirm `show_offers` and `handover_to_agent` exist in the dashboard only if those added tools are intended to be callable.
7. In a normal Chrome session, set microphone access for `https://voxi-ai.pages.dev/` to Allow, reload, and complete an English and Arabic spoken booking replay.
8. If permission is already Allow but the request remains pending, inspect Chrome enterprise policy, operating-system microphone privacy, device availability, and ElevenLabs session logs.

No repository CSP change is required for the current timeout. Primary worklets are self-hosted and the required secondary `blob:` worklet allowance is present.

### Live booking APIs

Provide an approved server gateway for:

- Current movies and sessions.
- Authoritative sold-out and wheelchair inventory.
- Seat plan, seat status, and expiring hold tokens.
- Authoritative price, fee, tax, and offer quote.
- PCI-compliant payment intent and final status.
- Booking creation and official admission ticket or QR.
- Cross-device booking lookup.
- Cancellation eligibility, idempotent cancellation, refund status, and reconciliation.

The browser must never receive upstream credentials.

### Knowledge base

- Assign an owner and approval date for each FAQ topic.
- Obtain legal and operations approval for refund, offer, accessibility, and age-rating wording.
- Add effective dates and expiry review for campaign content.
- Provide an escalation path for questions that the approved knowledge set cannot answer.

## Code-review findings

- Fixed the tomorrow-only extraction start.
- Fixed the Arabic generic discovery residual-title path.
- Fixed dynamic rich UI error punctuation normalization.
- Fixed media-retention rules so complete campaign removals are not silently retained.
- Preserved verified media only for clearly partial source responses.
- Preserved FAQ and `Continue` behavior without replacing the active booking panel.
- Verified there is no separate ticket quantity stage.
- Verified no real secret file is tracked.
- No live Vista credential or payment value is placed in a Vite environment variable.
- Resolved in the pending cold-start candidate: showtimes and ElevenLabs are split from the initial JavaScript, and build budgets enforce the result. A repeatable external hosted browser trace is still not present in repository CI.

## Evidence

### Screenshots

- [Before-fix hosted baseline](../evidence/screenshots/hosted-before-2026-07-16.png)
- [Final desktop showtimes](../evidence/screenshots/hosted-after-desktop-showtimes-2026-07-16.png)
- [Final 420 px English showtimes](../evidence/screenshots/hosted-after-mobile-showtimes-2026-07-16.png)
- [Final 420 px Arabic results](../evidence/screenshots/hosted-after-mobile-arabic-2026-07-16.png)
- [Final 420 px booking summary and reference QR](../evidence/screenshots/hosted-after-mobile-confirmation-2026-07-16.png)

### Logs

- [Hosted end-to-end evidence](../evidence/logs/hosted-e2e-2026-07-16.md)
- [Repository validation summary](../evidence/logs/pnpm-run-validate-2026-07-16.txt)
- [Production build summary](../evidence/logs/pnpm-run-build-2026-07-16.txt)
- [Converter and secret-scan evidence](../evidence/logs/converter-and-security-2026-07-16.txt)

## Final production-readiness status

| Decision | Status | Reason |
| --- | --- | --- |
| Leadership review with text and touch | PARTIALLY WORKING | The complete text and visual journey passed, but actual spoken voice remains blocked. |
| Public customer browsing of covered snapshot dates | PARTIALLY WORKING | Discovery is current and tested, but freshness still depends on the scheduled extraction and deploy path. |
| Public customer sales and service | BLOCKED | Live transactional and customer-service provider APIs are not connected. |

The repository-level fixes that could be reproduced safely are complete. The remaining gaps require browser permission, ElevenLabs dashboard or service evidence, approved provider APIs, production knowledge ownership, performance work, or physical-device testing.

## 16 July checkout continuity addendum

The pending local candidate fixes checkout loss after conversational and side-panel interruptions.

- Checkout remained visible for refund and parking questions.
- Offers and repeated offer refinement retained the correct checkout return target.
- Booking History and a stored booking detail retained the checkout draft.
- English and Arabic typed return phrases restored the exact movie, showtime, seats, and total.
- Voice transcript routing uses the same tested local restoration helper.
- Edit seats restored the exact seats and recalculated ticket count and pricing after a seat was removed.
- Payment authorization is protected from panel displacement.
- Local Arabic voice startup reached Voice chat, and ending voice returned to Text chat without losing the visible booking.
- Checkout completion rendered the saved booking summary and reference QR.
- Full validation, build, punctuation scan, 420 px layout inspection, and browser error check passed.

Detailed evidence: [checkout continuity validation](../evidence/logs/checkout-continuity-2026-07-16.md).

## 16 July annotated browser addendum

The latest local candidate supersedes the earlier microphone-timeout result for this environment.

- Voice chat connected successfully with the current agent and EU residency configuration.
- The exact annotated cinema-picker, DCC, transcript-history, checkout edit, and saved-summary cases passed.
- Progressive cinema and movie disclosure, combined time filtering, no-exact-time fallback, family-to-action replacement, specific IMAX selection, seat repricing, FAQ continuity, Arabic RTL, persistence, and cancellation continuation were replayed in the mounted browser.
- The unique cancellation title remained in cancellation. Duplicate movie titles requested the displayed booking reference and did not enter movie discovery.
- Browser Back left the standalone document and Forward restored it safely, while transient stage restoration remains available through the in-widget controls rather than browser history.
- The exact final candidate remains local until it is pushed and deployed.

Detailed matrix and evidence: [annotated end-to-end validation](../evidence/logs/annotated-end-to-end-validation-2026-07-16.md).
