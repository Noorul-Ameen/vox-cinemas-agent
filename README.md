# VOXi — VOX Cinemas conversational booking experience

VOXi is a React + Vite mobile experience that combines the real ElevenLabs React SDK with rich, touch-friendly cinema flows. The current integration uses official schedule content and an on-device transaction sandbox; production payment, Vista write, offer-redemption, and Genesys/OneView connectors remain explicitly gated.

## Included product flows

- A fresh 14–22 July 2026 snapshot with 22 VOX UAE cinemas, 42 scheduled films, 4,344 deduplicated sessions, nine published programming dates, and 13 display experiences.
- Official code-keyed movie posters, experience artwork, and active bank-offer imagery with first-party source attribution and resilient UI fallbacks.
- Fuzzy cinema/movie/session resolution with the original six ElevenLabs client tools preserved.
- Text, touch, and voice journeys for movies, showtimes, seats, checkout, confirmation, and cancellation. Typed chat starts without requesting microphone access.
- One unified conversation window where messages and the current relevant cinema/date/movie/showtime/ticket/seat/checkout/FAQ component render inline; previous interactive stages are removed.
- A logical journey ID, structured booking context and redacted recent turns carried across text WebSocket and voice WebRTC transports.
- The still-current portion of the nine extracted programming dates is selectable in the booking flow, with cinema-and-date-keyed movie loading and honest empty states when a cinema has no schedule.
- A sourced bilingual FAQ layer with 17 entries across locations/hours, tickets, experiences, food and drinks, offers, accessibility, age ratings, refunds, account/loyalty, wallet, support, and Voxi conversation capabilities.
- Client-side reference QR values, persisted local booking history, case-insensitive lookup, and durable local cancellation state. Reference-only QR values are explicitly distinguished from official cinema-entry tickets.
- 19 structured VOX UAE bank offers with 41 card profiles and conservative `eligible`, `ineligible`, or `card_required` results.
- Deterministic Customer Care handover preparation after an explicit request or two consecutive failed clarifications.
- Payment-free, transcript-sanitized `voxi.oneview-handover.v1` debug payload.
- Explicit English/Arabic conversation selection, saved language choice, confirmation-only switching, RTL layout, and LTR seat/booking/payment identifiers.
- VOX Cinemas UAE starts without silently choosing Mall of the Emirates; the guest selects one of 22 UAE cinemas before browsing movies.
- A protected 420 px mobile layout and the existing React error boundary.

## Run locally

```bash
npm install
npm run validate
npm run build
npm run dev
```

Open `http://localhost:5173` and type a message to start text chat without a microphone. Use the mic button only when you want voice and allow microphone access at that point. The public client identifier for the current Voxi agent is already used as a fallback in `vite.config.js`; `.env` is optional when testing this agent.

To override it locally:

```dotenv
VITE_AGENT_ID=agent_your_public_agent_id
```

Agent IDs are public client identifiers. Never commit ElevenLabs API keys, signed conversation tokens, Vista credentials, card data, or other secrets. A production Vista integration must use a server-side credential/token proxy.

## StackBlitz

The GitHub import URL is:

<https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

StackBlitz installs from `package.json` and starts Vite. Text chat needs no microphone permission. Voice WebRTC requires the preview to be opened in a browser context that permits microphone access.

## Cloudflare Pages deployment

The production site uses Cloudflare Pages' Git integration. Configure the Pages project with:

- Git repository: `Noorul-Ameen/vox-cinemas-agent`
- Production branch: `main`
- Root directory: `/`
- Build command: `npm ci && npm run validate && npm run build`
- Build output directory: `dist`

Snapshot mode needs no secret environment variables. `VITE_AGENT_ID` is an optional public client identifier and `VITE_VISTA_BASE` may contain only a public-safe server proxy URL; every `VITE_*` value is embedded in the browser bundle. Never add an ElevenLabs API key, signed conversation token, Vista credential, payment credential, or Cloudflare token to a `VITE_*` variable.

Cloudflare Pages automatically applies SPA fallback behavior when the build has an `index.html` and no top-level `404.html`, which is the configuration used here. Do not add a blanket `/* /index.html 200` rule to `_redirects`: on Pages, redirect rules run even when a matching static asset exists and that rule can intercept the hashed Vite assets. Security headers and cache policy live in `public/_headers`; Vite copies that file into `dist` during every build. The frame policy permits same-origin, approved VOX domains, and StackBlitz; add any future approved embedding origin there before launch.

No GitHub Actions deployment workflow is included because the existing Pages Git integration already deploys pushes to `main`; running both mechanisms can create duplicate production deployments. If the project is intentionally migrated to Direct Upload later, store a least-privilege Pages deployment token as the GitHub Actions secret `CLOUDFLARE_API_TOKEN` and the account identifier as `CLOUDFLARE_ACCOUNT_ID`, then disable automatic Pages Git deployments before enabling that workflow.

## ElevenLabs client tools

The original names remain unchanged:

- `show_movie_selection`
- `show_showtimes`
- `show_seat_map` (non-blocking)
- `select_seats`
- `show_booking_summary`
- `show_booking_for_cancellation` (blocks only while an active cancellation awaits confirmation)

The complete product adds:

- `show_offers`
- `handover_to_agent`

The two new declarations and prompt rules must also be present in the ElevenLabs dashboard for the agent to invoke them. See [ELEVENLABS_AGENT_SETUP.md](./ELEVENLABS_AGENT_SETUP.md).

The protected voice connection remains WebRTC with `serverLocation: "eu-residency"`. Text chat uses the SDK's text-only WebSocket path so it does not create an audio context or request microphone access.

For an audible text-to-voice continuation without another welcome, configure the dashboard first-message field as `{{voxi_session_opening}}`. The client supplies a localized first welcome or a continuation acknowledgement and then sends the full structured context with `sendContextualUpdate`. See [ELEVENLABS_AGENT_SETUP.md](./ELEVENLABS_AGENT_SETUP.md).

## Data snapshot and refresh

The shipped snapshot was crawled on 13 July 2026 UAE time and covers every programming date that VOX published from the next day: 14–22 July 2026. The extractor does not assume an eight-day window. It unions the official per-movie `availableDays` responses for Now Showing and Advance Booking, fetches only those movie/date pairs, and stops when the advertised dates are exhausted. A 31-day default safety cap prevents an accidentally unbounded crawl.

At runtime, a covered UAE date remains exact and past snapshot dates are not presented as current availability. If the current UAE date is outside the snapshot, the widget shows an honest no-programming state rather than cycling into stale sessions. Original VOX wall-clock values are retained, and an after-midnight session keeps both its programming day and actual performance date.

Shipped source assets:

- `data/vox_showtimes_full.json` — current flat extraction, crawl metadata, and media provenance
- `data/vox_sessions_08-15Jul.json.gz` — legacy compact fixture retained for converter regression coverage
- `data/movie_metadata_08-15Jul.json` — legacy metadata fixture
- generated `src/mockVistaData.js`

Regenerate the client dataset:

```bash
node scripts/extractVoxShowtimes.mjs --output data/vox_showtimes_full.json
python convert_extraction.py data/vox_showtimes_full.json
python scripts/validate_converter.py
```

With no `--start-date`, extraction starts tomorrow in `Asia/Dubai`. Optional controls are `--start-date YYYY-MM-DD`, `--max-days 1..90`, and `--workers 1..4`; the conservative default is two workers. The crawler uses only official public-site data routes, avoids booking/seat-plan routes, retries rate limits and transient errors, and fails instead of treating authentication or partial responses as “no availability.”

The current VOX web app requires a rotating browser API key plus a short-lived anonymous guest token. The extractor discovers both at runtime, never logs or stores them, and writes no real environment secrets. `VOX_PUBLIC_API_KEY` is supported only as an optional process-level recovery override and must not be committed. These routes are undocumented and can change; run refreshes from a normal permitted network at a low rate.

`convert_extraction.py` accepts both the current flat `{ catalog, cinemas, sessions, experienceMedia, offerMedia }` extraction and the legacy compact gzip. It preserves official poster URLs and source session IDs; it never fabricates asset URLs.

Artwork URLs remain on official VOX/MAF hosts or their campaign CDN and include source-page provenance. Posters, brand logos, and experience artwork remain the property of their rights holders. Confirm permission before mirroring or redistributing them; the interface renders remote URLs directly with neutral fallbacks.

## Validation

`npm run validate` checks:

- dynamic data counts, source-ID deduplication, crawl completeness, official media URLs, UAE date behavior, and fuzzy title matching;
- booking migration, lookup, persistence, and cancellation;
- all 19 offer rules, all extracted experiences, ambiguous bank/card aliases, and tri-state outcomes;
- handover schema, two-failure detection, seat/cancellation context, payment removal, and transcript redaction;
- English/Arabic dictionary parity and confirmation-only language-switch scenarios;
- sourced bilingual FAQ schema, intent resolution, API/static classification and knowledge serialization;
- logical conversation continuity, handoff redaction, multi-date selection, unified inline rendering and lifecycle reset hooks;
- mic-free text startup, protected ElevenLabs voice WebRTC, tool-name, seat-selection, error-boundary, RTL-seat, branding, and 420 px invariants.

`npm run validate:converter` separately exercises the Python compact/flat conversion compatibility path.

## Main files

- `src/App.jsx` — widget state, ElevenLabs connection, eight client tools, and journey orchestration.
- `src/vistaClient.js` — Vista-shaped read layer and local booking search.
- `src/mockVistaData.js` — generated, deterministic UAE schedule snapshot.
- `src/bookingStore.js` — backward-compatible local booking persistence.
- `src/offers/` — structured offer knowledge and resolver.
- `src/knowledge/` — sourced bilingual FAQ data, resolver and bounded agent context.
- `src/lib/conversationJourney.js` — logical session state and redacted text-to-voice handoff.
- `src/lib/handoverSummary.js` — safe OneView-ready handover payload.
- `src/lib/voxiSession.js` and `src/lib/languageSwitch.js` — VOXI runtime guidance and strict bilingual switching.
- `src/i18n/` — English/Arabic locale provider and copy.
- `src/components/` — cinema, movie, seat, checkout, QR/history, offers, and handover UI.
- `CONCIERGE_IMPLEMENTATION.md` — root-cause review, state model, ElevenLabs handoff, FAQ migration plan, verification and production dependencies.

## Current integration boundaries

- Checkout, cards, wallets, booking creation, refunds, and cancellation writes stay in the on-device transaction sandbox. Setting `VITE_VISTA_BASE` changes read data only; it does not silently enable payment or write operations.
- Reference QR values contain only the booking reference and are not cinema-entry tickets.
- Offers are display-only and cannot be redeemed.
- Handover prepares the safe transfer context but makes no Genesys or OneView network call until those connectors are enabled.
- `VITE_VISTA_BASE` enables a read-shaped live path only when the configured server safely injects credentials. The browser never reads a Vista API key. Future pricing/refund adapters require explicit proxy paths, and unverified local bookings can never invoke a refund write. Do not expose credentials in Vite environment variables.
