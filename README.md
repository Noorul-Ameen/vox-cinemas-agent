# VOXi: VOX Cinemas conversational booking experience

VOXi is a React and Vite conversational cinema experience for VOX Cinemas UAE. It supports text-first discovery, optional ElevenLabs voice, bilingual English and Arabic interaction, seat selection, a payment preview, and device-local booking history with truthful transaction boundaries.

Production: <https://voxi-ai.pages.dev/>

Repository: <https://github.com/Noorul-Ameen/vox-cinemas-agent>

## Current release

- Branch: `main`
- Release source: `main`
- Snapshot: `20260724-8da7b33793bd2182`
- Built asset: `/assets/index-Bts2SRO5.js`
- Hosted asset cache policy: immutable
- Schedule coverage: 2026-07-24 through 2026-08-12
- Schedule: 9,645 sessions, 35 films, 22 cinemas, and 20 dates
- Sessions today: 1,407
- Sessions tomorrow: 1,402
- Schedule shards: 299
- Official movie-information records: 96
- ElevenLabs contract: `2026-07-24.1`
- ElevenLabs prompt SHA-256: `9daa241841ccb6321673f47c560bb9e374677d5f421b27bae3ecb94fa210f4e2`

Production `release.json` is the source of truth for the current deployment commit. The runtime and data source above passed the complete local validation before publication.

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

Contract `2026-07-24.1` was published and read back from the target dashboard on 24 July 2026. Its prompt SHA-256 is `9daa241841ccb6321673f47c560bb9e374677d5f421b27bae3ecb94fa210f4e2`.

Controlled Chrome microphone-denial recovery passed after 45 seconds and retained the active state. Live Chrome also passed an Arabic rating query, and the movie list remained visible. Acoustic English and Arabic recognition and audible output still require human acceptance in a normal HTTPS browser.

Public agent authentication or origin allowlisting and an approved conversation-data retention policy remain production governance gates.

## Schedule data

The current official VOX UAE public-site snapshot contains:

- 9,645 sessions
- 35 films
- 22 cinemas
- 20 dates from 2026-07-24 through 2026-08-12
- 1,407 sessions today
- 1,402 sessions tomorrow
- 299 versioned schedule shards
- 96 official movie-information records

The snapshot is not live inventory. It does not provide seat holds, payment, official ticket QR issuance, provider cancellation, provider refunds, or customer-care handover.

The automated refresh runs daily at 02:30 UTC, which is 06:30 UAE, 30 minutes after the 06:00 programming-day cutoff. A redundant refresh check runs every Thursday at 06:30 UTC, which is 10:30 UAE. Each candidate must pass the complete validators and production build before it can be published.

Manual [Refresh VOX UAE showtimes run #13](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30008195281) succeeded in 2m41s and published data commit `4797e37c38e2d20ce7d7e7bf18d9898b78c89e79`. [Validate VOXi run #4](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30008628943) then passed that data commit in 1m29s.

The prior Node 20 artifact warning is removed in this release. Both upload steps use `actions/upload-artifact` v7.0.1 pinned to its full commit SHA.
[Validate VOXi run #7](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30009245035) passed without annotations in 1m27s, and [Hosted VOXi smoke run #7](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30009356648) passed in 45s.

## Validation status

- Full local validators: PASS
- Production build: PASS
- Local E2E: 23/23 PASS
- Hosted exact-commit smoke: 1/1 PASS
- Hosted E2E: 23/23 PASS
- Package audit: no known production vulnerabilities
- Secret scan: clean
- Manual refresh workflow run #13: PASS in 2m41s, data commit published
- Validate VOXi workflow run #4: PASS in 1m29s against the data commit
- Warning-free Validate VOXi run #7: PASS in 1m27s
- Hosted VOXi smoke run #7: PASS in 45s
- Artifact-action upgrade: both upload steps use `actions/upload-artifact` v7.0.1 pinned SHA, removing the prior Node 20 warning
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
