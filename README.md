# VOXi: VOX Cinemas conversational booking experience

VOXi is a React and Vite conversational cinema experience for VOX Cinemas UAE. It supports text-first discovery, optional ElevenLabs voice, bilingual English and Arabic interaction, seat selection, a payment preview, and device-local booking history with truthful transaction boundaries.

Production: <https://voxi-ai.pages.dev/>

Repository: <https://github.com/Noorul-Ameen/vox-cinemas-agent>

## Current release

- Branch: `main`
- Validated runtime source commit: `1af1d1908545483ff9659288fc645fac7fdda6d9`
- Snapshot: `20260723-180b0b07f8429acf`
- Hosted asset: `/assets/index-DqBCeyow.js`
- Hosted asset size: 889,938 bytes
- Hosted asset cache policy: immutable
- Schedule coverage: 2026-07-23 through 2026-08-12
- Schedule: 10,606 sessions, 35 films, 22 cinemas, and 21 dates
- Sessions today: 1,116
- Sessions tomorrow: 1,398
- Schedule shards: 320
- Official movie-information records: 83
- ElevenLabs contract: `2026-07-23.3`
- ElevenLabs prompt SHA-256: `dc8d1af309c247a642c155e017e2b26b4caf1b3801c429f5f8a883ff5f3ca467`

Production `release.json` is the source of truth for the current deployment commit. The runtime source above was deployed with the listed snapshot and passed the complete hosted validation.

## Product coverage

- Progressive movie discovery by cinema, city, date, time, genre, language, experience, movie, and audience.
- Exact-time and nearest-time showtime handling.
- Grounded movie ratings, child-suitability guidance, runtime, language, genre, synopsis, subtitle status, and explicit unknown-fact handling.
- Movie context retained across short follow-up questions.
- Deterministic selection from visible movie and showtime cards.
- Text, touch, and optional voice entry through one shared journey.
- English and Arabic UI, RTL rendering, and LTR treatment for seats, times, references, and payment identifiers.
- Seat-derived ticket count with no separate quantity selector.
- Checkout return, seat replacement, recalculated totals, and stale-selection cleanup.
- Payment preview, device-local booking summary, reference QR, booking history, and device-only cancellation with clear disclosures.
- FAQ answers that preserve the active booking panel.
- Current-catalog and current-seat revalidation before paused stages are restored.
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

Never commit ElevenLabs API keys, signed conversation tokens, Vista credentials, card data, Cloudflare tokens, or other secrets. A production provider integration must use server-side credentials and token gateways.

## Deployment

Cloudflare Pages configuration:

- Production branch: `main`
- Root directory: `/`
- Build command: `npm ci && npm run validate && npm run build`
- Output directory: `dist`

The verified production root is <https://voxi-ai.pages.dev/>. Validation is tied to the exact commit returned by production `release.json`.

## ElevenLabs integration

Protected integration behavior includes:

- WebRTC voice transport
- WebSocket text transport
- `serverLocation: "eu-residency"`
- Existing client-tool names
- `select_seats`
- Fuzzy movie and session resolvers
- Explicit English and Arabic language routing
- Shared text and voice journey state

Contract `2026-07-23.3` was published and read back from the target dashboard. Its prompt SHA-256 is `dc8d1af309c247a642c155e017e2b26b4caf1b3801c429f5f8a883ff5f3ca467`.

Controlled Chrome microphone-denial recovery passed after 45 seconds and retained the active state. Live Chrome also passed an Arabic rating query, and the movie list remained visible. Acoustic English and Arabic recognition and audible output still require human acceptance in a normal HTTPS browser.

Public agent authentication or origin allowlisting and an approved conversation-data retention policy remain production governance gates.

## Schedule data

The current official VOX UAE public-site snapshot contains:

- 10,606 sessions
- 35 films
- 22 cinemas
- 21 dates from 2026-07-23 through 2026-08-12
- 1,116 sessions today
- 1,398 sessions tomorrow
- 320 versioned schedule shards
- 83 official movie-information records

The snapshot is not live inventory. It does not provide seat holds, payment, official ticket QR issuance, provider cancellation, provider refunds, or customer-care handover.

The automated refresh runs daily at 02:30 UTC, which is 06:30 UAE, 30 minutes after the 06:00 programming-day cutoff. A redundant refresh check runs every Thursday at 06:30 UTC, which is 10:30 UAE. Each candidate must pass the complete validators and production build before it can be published.

## Validation status

- Full local validators: PASS
- Production build: PASS
- Local E2E: 23/23 PASS
- Hosted exact-commit smoke: 1/1 PASS
- Hosted E2E: 23/23 PASS
- Package audit: no known production vulnerabilities
- Secret scan: clean
- Live Chrome Arabic rating query: PASS, with movie list retained
- Controlled Chrome microphone-denial recovery after 45 seconds: PASS, with state retained
- Acoustic English and Arabic voice: HUMAN ACCEPTANCE REQUIRED
- Live customer transactions: BLOCKED BY EXTERNAL PROVIDER APIS

See [FINAL_VALIDATION_REPORT_2026-07-23.md](./FINAL_VALIDATION_REPORT_2026-07-23.md), [PRODUCTION_READINESS_REPORT.md](./PRODUCTION_READINESS_REPORT.md), and [docs/end-to-end-test-report.md](./docs/end-to-end-test-report.md).

## Main files

- `src/App.jsx`: journey orchestration, rendering, transport switching, client tools, booking, and cancellation.
- `src/vistaClient.js`: provider-shaped read layer and snapshot capability boundaries.
- `src/mockVistaData.js`: generated current UAE schedule snapshot.
- `src/bookingStore.js`: versioned device-local booking persistence.
- `src/lib/discoveryPreferences.js`: persistent criteria parsing and filtering.
- `src/lib/customerFacingText.js`: customer-facing punctuation normalization.
- `src/lib/voiceStartup.js`: bounded voice startup and failure classification.
- `src/lib/voxiPrompt.js`: published bilingual ElevenLabs prompt contract.
- `src/lib/voxiSession.js`: first-message, retained-state, and session guidance.
- `src/lib/movieRating.js`: canonical UAE age ratings and suitability rules.
- `src/lib/movieInformation.js`: grounded movie-detail question routing and answers.
- `src/knowledge/`: sourced bilingual FAQ data and resolver.
- `src/offers/`: structured offer catalog and eligibility resolver.

## Production boundaries

- Checkout is a payment preview. It does not charge a card or reserve a seat.
- The displayed QR contains a local reference and is not an official admission ticket.
- Cancellation updates only the device-local record and does not contact a provider or issue a refund.
- Offers are guidance only and require official checkout verification.
- Handover creates a redacted payload but does not contact a customer-care platform.
- Live customer sales require approved provider APIs and end-to-end certification.
