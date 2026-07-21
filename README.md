# VOXi: VOX Cinemas conversational booking experience

VOXi is a React and Vite conversational cinema experience for VOX Cinemas UAE. It combines text-first discovery, optional ElevenLabs voice, compact movie and offer media, seat-based checkout, bilingual English and Arabic interaction, device-local booking history, and truthful transaction boundaries.

Hosted app: <https://voxi-ai.pages.dev/>

StackBlitz: <https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

## Current product coverage

- Official VOX UAE public-site schedule snapshot for 22 July to 12 August 2026.
- 11,699 deduplicated sessions, 45 scheduled films, and 22 cinemas.
- 1,361 sessions on 22 July and 1,376 sessions on 23 July.
- Official movie posters, 14 experience-media records, and 21 current offer-media records with source provenance and explicit fallbacks.
- Progressive movie discovery using cinema, city, date, time, genre, language, experience, movie, and audience criteria already supplied by the guest.
- Exact-time and nearest-time showtime handling.
- Deterministic exact-title selection from visible movie cards for both typed and normalized voice turns.
- Deterministic exact-time selection from visible showtimes to the real session seat map for typed and normalized voice turns.
- Text, touch, and optional voice entry through one shared logical journey.
- English and Arabic UI, explicit language selection, RTL rendering, and LTR treatment for seats, times, references, and payment identifiers.
- A protected 420 px widget layout with a white and blue visual system.
- Seat-derived ticket count. One selected seat equals one ticket. There is no quantity step or quantity selector.
- Return from checkout to the seat map, seat replacement, recalculated totals, and stale-selection cleanup.
- Payment preview, device-local booking summary, reference QR, booking history, and device-only cancellation with clear disclosures.
- Inline FAQ answers that preserve the active booking panel. No separate FAQ guidance panel is rendered.
- Current-catalog and current-seat revalidation before paused movie, showtime, or seat stages are restored.
- Explicit journey clearing, authoritative visible-date handling, and guarded guest-selected stages that reject delayed tool regressions.
- Daily validated schedule refresh automation and a Thursday supplementary refresh.
- Customer-facing punctuation validation that rejects Unicode em dash and en dash characters.

## Run locally

```bash
npm install
npm run validate
npm run build
npm run dev
```

Open `http://localhost:5173`. Text chat starts without microphone access. The microphone is requested only when the guest selects voice.

An optional public client identifier can be supplied locally:

```dotenv
VITE_AGENT_ID=agent_your_public_agent_id
```

Never commit ElevenLabs API keys, signed conversation tokens, Vista credentials, card data, Cloudflare tokens, or other real secrets. A production Vista integration must use a server-side credential and token gateway.

## Cloudflare Pages

The current site uses Cloudflare Pages Git integration:

- Repository: `Noorul-Ameen/vox-cinemas-agent`
- Production branch: `main`
- Root directory: `/`
- Build command: `npm ci && npm run validate && npm run build`
- Output directory: `dist`

The 22 July corrective release was deployed from `main` at commit `bc34e3e0ea53b27aa5e276e2e682f4b3389b8131`. Cloudflare serves `/assets/index-Cc1yKhu_.js` and the versioned showtime snapshot. The complete local validator, production build, mounted-browser replay, Cloudflare asset-parity check, and final hosted replay passed. See [FINAL_VALIDATION_REPORT_2026-07-22.md](./FINAL_VALIDATION_REPORT_2026-07-22.md) for the tested journeys and remaining external boundaries.

Snapshot mode requires no secret environment variables. If `VITE_VISTA_BASE` is enabled later, it must point only to a public-safe server gateway. Every `VITE_*` value is embedded in the browser bundle.

## ElevenLabs integration

Protected connection behavior remains unchanged:

- WebRTC voice transport
- `serverLocation: "eu-residency"`
- Existing client-tool names
- `select_seats`
- Fuzzy movie and session resolvers

The original client tools remain:

- `show_movie_selection`
- `show_showtimes`
- `show_seat_map`
- `select_seats`
- `show_booking_summary`
- `show_booking_for_cancellation`

The product also supports:

- `show_offers`
- `handover_to_agent`

Text chat uses the SDK text-only WebSocket path. Voice uses protected WebRTC and self-hosted primary ElevenLabs AudioWorklets under `public/elevenlabs/`. The CSP permits the SDK-required secondary `blob:` worklet and continues to block `data:` scripts.

Repository tests validate transport contracts, startup timeouts, explicit agent-language overrides, bilingual copy, state preservation, and protected configuration. ElevenLabs contract `2026-07-22.1` was published and read back from the signed-in target dashboard with the expected first message and repository rules. The latest automated local voice attempt ended in the bounded microphone-permission timeout, so real microphone recognition and TTS remain a manual HTTPS-browser check. See [ELEVENLABS_AGENT_SETUP.md](./ELEVENLABS_AGENT_SETUP.md).

## Schedule data and refresh

The current extraction completed at `2026-07-21T20:11:33.705Z`. It uses official VOX UAE public-site routes under:

- `https://uae.voxcinemas.com`
- `https://uae-apife.voxcinemas.com`

The extractor starts on the current UAE date, discovers official advertised programming dates, stops when the official available days are exhausted, removes duplicate source sessions, and fails on authentication or incomplete schedule responses. A 31-day safety cap prevents an unbounded crawl.

Current crawl facts:

- 11,771 raw rows
- 11,699 unique sessions
- 72 duplicates removed
- 22 programming dates, from 22 July to 12 August 2026
- 45 films and 22 cinemas
- No missing official movie posters in the promoted snapshot
- 5 fresh experience-media records and 9 retained first-party records after a partial experience-media response
- 21 fresh offer-media records and no retained offer records

The workflow `.github/workflows/refresh-vox-showtimes.yml` runs daily at 01:30 UTC, which is 05:30 UAE, and on Thursday at 06:30 UTC, which is 10:30 UAE. It supports manual dispatch. The transactional refresh validates freshness, coverage, completeness, source IDs, poster and media provenance, generated client imports, all repository validators, and the production build before promoting files.

```bash
npm run refresh:data
```

The release candidate uses versioned snapshot `20260721-a101604217549f5f`. It does not silently cycle to stale dates. When a requested date is not covered, the UI shows an honest unavailable state. Past showtimes are filtered with UAE time and a 06:00 programming-day cutoff.

Live sold-out status, seat inventory, holds, authoritative pricing, payment, official admission QR, refunds, and provider cancellation require a licensed server integration and are not represented as live in snapshot mode.

## Validation

`npm run validate` executes the aggregate validator suite covering:

- Extractor behavior, data counts, freshness, deduplication, media provenance, and official source IDs.
- Persistent discovery criteria, specific-movie filtering, genre, audience, language, experience, and nearest-time behavior.
- Deterministic exact visible-movie selection for text and normalized voice, with generic references kept non-selecting.
- Deterministic exact visible-showtime selection for text and normalized voice, with ambiguous times and information questions kept non-selecting.
- English and Arabic discovery, including the exact Arabic language, cinema, and date request regression.
- Booking storage, cancellation routing and safety, explicit journey clearing, seat-derived ticket count, quote races, and stale-state invalidation.
- Current-catalog paused-stage restoration, authoritative programming-date selection, and capitalization-safe location parsing.
- Offers, FAQ knowledge, handover redaction, text and voice journey state, language switching, transport recovery, and classified voice startup errors.
- Protected tool names, fuzzy resolvers, WebRTC, EU residency, error boundary, RTL seats, and 420 px layout.
- Static and runtime rejection of customer-facing Unicode em dash and en dash characters, including dynamic provider error fields.

`scripts/validate_converter.py` separately validates the current flat extraction and the legacy compact fixture.

Current July 22 validation status:

- Final corrective local and Cloudflare mounted 420 px English and Arabic text journeys: PASS.
- Repository WebRTC, WebSocket, bilingual transport, location, availability, continuity, and punctuation checks: PASS.
- Local movie-result rendering: approximately 334 to 368 ms in sampled mounted-browser runs.
- Final Arabic mounted journey: Ezma `17:55`, A6 and A7, two seats, AED 84, food FAQ pause, and exact checkout restore all passed with empty browser error and warning logs.
- Final corrective cold-load budget: PASS at 230,223 of 230,400 initial JavaScript Brotli bytes, bundle `/assets/index-Cc1yKhu_.js`.
- ElevenLabs contract `2026-07-22.1`: PUBLISHED AND DASHBOARD-VERIFIED.
- Real microphone recognition and TTS: BLOCKED by the in-app browser permission timeout and still requires manual acceptance.
- Cloudflare validation of corrective commit `bc34e3e0ea53b27aa5e276e2e682f4b3389b8131`: PASS for the expected bundle and snapshot, Afghan clarification, IMAX refinement, guest-authorized seats, two-seat AED 84 checkout, FAB FAQ restoration, device-only payment summary and QR, cancellation by title, bilingual discovery and voice transport, grounded unsupported locations, bank offers, 420 px layout, and browser navigation.
- Final fresh-tab browser logs: PASS with no errors or warnings. The expected WebSocket-close warning occurred only during the intentional language restart in the earlier long-running replay.
- First Supergirl cards appeared within 1.733 seconds, including a 1.4-second observation wait.
- Live customer transaction readiness: BLOCKED by external inventory, payment, ticket, cancellation, and refund APIs.

The authoritative evidence and readiness decision are in [FINAL_VALIDATION_REPORT_2026-07-22.md](./FINAL_VALIDATION_REPORT_2026-07-22.md). A shorter historical summary is in [docs/end-to-end-test-report.md](./docs/end-to-end-test-report.md).

## Main files

- `src/App.jsx`: journey orchestration, rendering, transport switching, client tools, booking, and cancellation.
- `src/vistaClient.js`: Vista-shaped read layer and snapshot capability boundaries.
- `src/mockVistaData.js`: generated current UAE schedule snapshot.
- `src/bookingStore.js`: versioned device-local booking persistence.
- `src/lib/discoveryPreferences.js`: persistent criteria parsing and filtering.
- `src/lib/customerFacingText.js`: customer-facing punctuation normalization.
- `src/lib/voiceStartup.js`: bounded voice startup and failure classification.
- `src/lib/voxiSession.js`: bilingual agent prompt and session guidance.
- `src/knowledge/`: sourced bilingual FAQ data and resolver.
- `src/offers/`: structured offer catalog and eligibility resolver.
- `scripts/refreshVoxData.mjs`: transactional refresh coordinator.
- `scripts/validateCustomerFacingPunctuation.mjs`: repository and runtime punctuation compliance.

## Production boundaries

- The current checkout is a payment preview. It never submits a charge or reserves a seat.
- The displayed QR contains only the local booking reference and is not an admission ticket.
- Cancellation updates the device-local record and does not contact VOX or issue a refund.
- Offers are display-only and cannot be redeemed.
- Handover creates a redacted payload but does not contact Genesys or OneView.
- Live customer sales remain blocked until approved provider gateways are implemented and validated.
