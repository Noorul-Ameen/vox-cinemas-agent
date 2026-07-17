# Bank offers and ElevenLabs validation evidence

Test date: 17 July 2026, UAE

Candidate: local working tree, not pushed or deployed

Local URL: <http://127.0.0.1:4173/>

ElevenLabs target: published agent `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`

## Official bank-offer review

Official pages reviewed:

- <https://uae.voxcinemas.com/offers/bank-deals>
- <https://uae.voxcinemas.com/offers/bank-deals/fab-buy-one-ticket-get-one-free>
- <https://uae.voxcinemas.com/offers/bank-deals/fab-buy-one-ticket-get-one-free/terms-conditions>

Implemented dataset result:

- 21 current promotions.
- 20 offer groups.
- 42 card or card-tier profiles.
- 882 validated English and Arabic topic-answer cases.
- Official catalogue, detail, and terms URLs retained per promotion when published.
- Explicit missing-publication treatment for Sharjah Islamic Bank and the standalone Citi BOGO page.
- Separate source treatment for Citi standalone BOGO and the detailed Citi 30 percent or BOGO campaign.

## Automated commands

### Aggregate validation

Command: `pnpm run validate`

Result: PASS

Selected output:

- Validated 22 cinemas, 37 films, 9,668 sessions, 20 dates, and official movie, experience, and offer media.
- Validated 21 promotions across 20 offer groups, 42 card profiles, 882 bilingual topic answers, official sources, unpublished-detail boundaries, and tri-state eligibility scenarios.
- Offer text fallback validation passed.
- Validated exact handover reasons, distinct clarification turns, idempotent summary-only behavior, and payment-free redaction.
- Validated ElevenLabs contract `2026-07-17.2`: eight client tools, 13 dynamic variables, WebRTC, EU residency, bilingual explicit-switch policy, and prompt hash.
- Validated customer-facing punctuation across 398 repository text files.
- Validated showtime coverage from 17 July through 5 August 2026, with 1,451 sessions on 17 July and 1,442 on 18 July.

### Production build

Command: `pnpm run build`

Result: PASS

- Initial requests: 2.
- Initial JavaScript raw: 773,130 bytes.
- Initial JavaScript gzip: 218,599 bytes.
- Initial JavaScript Brotli: 199,055 bytes.
- Initial CSS gzip: 623 bytes.
- Cold-load budget: PASS.

Vite emitted its advisory chunk-size warning. The enforced startup and schedule-shard budgets passed.

## Mounted browser checks

Build: Vite production preview at `http://127.0.0.1:4173/`

### Typed fallback

| Input | Result |
| --- | --- |
| `Tell me the FAB offer` | Concise First Abu Dhabi Bank answer and one expanded FAB issuer card. |
| `Which ENBD cards qualify?` | Emirates NBD card summary and one expanded Emirates NBD issuer card. |
| `ما عرض بنك أبوظبي الأول؟` | Arabic FAB answer and one expanded Arabic FAB issuer card. |

All three passed while the transport status was disconnected. No microphone request was needed.

### Eligibility context

Selecting `FAB SHARE Credit Card` without a selected showtime returned:

- `More details needed`.
- Guidance to select a showtime experience.
- Final eligibility confirmation at VOX checkout.

It did not return a false ineligible or unsupported-experience result.

### Search precision

| Search | Issuer cards |
| --- | ---: |
| SIB | 1 |
| FAB | 1 |
| Citibank | 1 |
| Emirates NBD | 1 |
| HSBC | 1 |
| ADCB | 1 |
| Visa Infinite | 8 |
| buy one get one free | 14 |

### Source-boundary behavior

- Sharjah Islamic Bank displayed a clear warning that official card names and conditions are not published.
- Citibank displayed two current campaigns and warned that the detailed card tiers come from the separate 30 percent or BOGO campaign.
- FAB displayed the exact official details and terms links.

### Visual and runtime results

- Issuer cards present: 20.
- Rendered official offer images: 19.
- Failed rendered images after catalogue traversal: 0.
- Widget width: 420 px.
- English direction: LTR.
- Arabic document values: `lang=ar`, `dir=rtl`.
- Widget-level horizontal overflow: none.
- Widget console errors: 0.
- Widget console warnings: 0.

Screenshots:

These screenshots were captured before the final subtitle terminology changed from issuers to offer groups. The final build contains the corrected label.

- [FAB compact offer](../screenshots/local-bank-offers-fab-2026-07-17.png)
- [Arabic FAB offer](../screenshots/local-bank-offers-arabic-2026-07-17.png)
- [Captured mounted browser results](./bank-offers-mounted-browser-results-2026-07-17.json)

## ElevenLabs repository contract

Contract file: [config/elevenlabs-agent-contract.json](../../config/elevenlabs-agent-contract.json)

Contract result: PASS

- Version: `2026-07-17.2`.
- Target public agent ID: `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`.
- Prompt SHA-256: `cd7e157c550647ba23d87073e57800ac083acc04caa4a4bf8a5aa134d52351ac`.
- First message: `{{voxi_session_opening}}`.
- Languages: English and Arabic only.
- Automatic language detection: disabled.
- Required dynamic variables: 13.
- Required tools: eight exact client tools.
- Voice: WebRTC.
- Typed transport: WebSocket with text-only override.
- Server location: `eu-residency`.

## Published ElevenLabs live audit

Result: PASS FOR DASHBOARD CONTRACT AND LOCAL PLUS HOSTED LIVE TEXT

| Check | Published result |
| --- | --- |
| Agent ID | `agent_0001kx3xc0b4f6s8dqy9qnejm4qr` |
| Agent name | `VOXi - VOX Cinemas UAE` |
| EU public token endpoint | HTTP 200 |
| Prompt | Exact repository `VOXI_AGENT_PROMPT` match after ignoring editor-only surrounding whitespace |
| First message | `{{voxi_session_opening}}` |
| Languages | English and Arabic |
| Runtime variables | All 13 VOXi journey variables supplied by the widget; dashboard test default set for `voxi_session_opening` |
| Tools | Eight exact client-tool names and contract descriptions |
| Wait for response | Enabled on all eight tools |
| Detect language | Off |
| First-message override | Off |
| Text-only override | On |
| Agent language override | Forced on and disabled by ElevenLabs when Arabic is configured; the widget sends no language override |

Published client tools:

- `show_movie_selection`
- `show_showtimes`
- `show_seat_map`
- `select_seats`
- `show_booking_summary`
- `show_booking_for_cancellation`
- `show_offers`
- `handover_to_agent`

### Local and hosted live text smoke

- Status reached: `Text chat`.
- Voxi identity response: "I'm Voxi, the warm, confident bilingual AI assistant for VOX Cinemas UAE."
- FAB follow-up response: "The FAB offer is for 2D tickets only."
- The hosted widget returned grounded English and Arabic Voxi identity responses.
- Local and hosted widget console errors: 0.
- Local and hosted widget console warnings: 0.

Voice startup reached the microphone permission gate. The controlled in-app browser and Chrome test surface did not expose a microphone permission state, so the request used the bounded timeout and returned safely to text chat. No live microphone audio was captured.

## Current status

| Scope | Status |
| --- | --- |
| Repository validation and production build | PASS |
| Local offer data, search, rendering, and typed fallback | PASS |
| Current local showtime snapshot | PASS |
| Latest Cloudflare candidate parity | NOT VERIFIED |
| Contracted ElevenLabs dashboard | PASS |
| Live agent-backed text | PASS LOCAL AND HOSTED |
| Live end-to-end voice audio | ENVIRONMENT BLOCKED |
| Offer redemption | BLOCKED |
| Customer sales and provider service | BLOCKED |

The published configuration and remaining external validation steps are documented in [ELEVENLABS_AGENT_SETUP.md](../../ELEVENLABS_AGENT_SETUP.md) and [docs/end-to-end-test-report.md](../../docs/end-to-end-test-report.md).
