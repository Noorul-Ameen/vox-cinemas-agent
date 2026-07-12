# VOXi — VOX Cinemas conversational booking prototype

VOXi is a React + Vite mobile widget that combines the real ElevenLabs React SDK with rich, touch-friendly cinema flows. The prototype keeps writes local and simulated: it does not charge cards, redeem bank offers, call Vista write endpoints, or connect to Genesys/OneView.

## Included product flows

- 22 VOX UAE cinemas, 41 films, 6,500 deduplicated sessions, eight programming dates, and 13 experiences.
- Fuzzy cinema/movie/session resolution with the original six ElevenLabs client tools preserved.
- Touch and voice journeys for movies, showtimes, seats, simulated checkout, confirmation, and cancellation.
- Client-side QR tickets, persisted booking history, case-insensitive lookup, and durable cancellation state.
- 19 structured VOX UAE bank offers with 41 card profiles and conservative `eligible`, `ineligible`, or `card_required` results.
- Deterministic simulated human handover after an explicit request or two consecutive failed clarifications.
- Payment-free, transcript-sanitized `voxi.oneview-handover.v1` debug payload.
- English and Arabic UI, saved language choice, RTL layout, and LTR seat/booking/payment identifiers.
- A protected 420 px mobile layout and the existing React error boundary.

## Run locally

```bash
npm install
npm run validate
npm run build
npm run dev
```

Open `http://localhost:5173`, tap the mic, and allow microphone access. The public client identifier for the current prototype agent is already used as a fallback in `vite.config.js`; `.env` is optional when testing this agent.

To override it locally:

```dotenv
VITE_AGENT_ID=agent_your_public_agent_id
```

Agent IDs are public client identifiers. Never commit ElevenLabs API keys, signed conversation tokens, Vista credentials, card data, or other secrets. A production Vista integration must use a server-side credential/token proxy.

## StackBlitz

The GitHub import URL is:

<https://stackblitz.com/github/Noorul-Ameen/vox-cinemas-agent>

StackBlitz installs from `package.json` and starts Vite. Microphone/WebRTC access requires the preview to be opened in a browser context that permits microphone access.

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

The connection remains WebRTC with `serverLocation: "eu-residency"`.

## Data snapshot and refresh

The shipped snapshot covers the 08–15 July 2026 programming window. At runtime, a covered UAE date remains exact; dates outside the window roll onto it so the demo always has sessions. The original VOX wall-clock time is displayed without timezone conversion, and after-midnight sessions remain attached to their requested programming day.

Shipped source assets:

- `data/vox_sessions_08-15Jul.json.gz`
- `data/movie_metadata_08-15Jul.json`
- generated `src/mockVistaData.js`

Regenerate the client dataset:

```bash
node scripts/extractVoxShowtimes.mjs --start-date 2026-07-08 --output data/vox_showtimes_full.json
python convert_extraction.py data/vox_showtimes_full.json
python scripts/validate_converter.py
```

`convert_extraction.py` accepts both the shipped compact gzip and the handoff-style flat `{ catalog, cinemas, sessions }` extraction. A fresh flat extraction should keep `programmingDate` on sessions that cross midnight.

## Validation

`npm run validate` checks:

- data counts, deduplication, metadata completeness, UAE date behavior, and fuzzy title matching;
- booking migration, lookup, persistence, and cancellation;
- all 19 offers, all 13 extracted experiences, ambiguous bank/card aliases, and tri-state outcomes;
- handover schema, two-failure detection, seat/cancellation context, payment removal, and transcript redaction;
- English/Arabic dictionary parity;
- protected ElevenLabs, WebRTC, tool-name, seat-selection, error-boundary, RTL-seat, and 420 px invariants.

`npm run validate:converter` separately exercises the Python compact/flat conversion compatibility path.

## Main files

- `src/App.jsx` — widget state, ElevenLabs connection, eight client tools, and journey orchestration.
- `src/vistaClient.js` — Vista-shaped read layer and local booking search.
- `src/mockVistaData.js` — generated, deterministic UAE schedule snapshot.
- `src/bookingStore.js` — backward-compatible local booking persistence.
- `src/offers/` — structured offer knowledge and resolver.
- `src/lib/handoverSummary.js` — safe prototype OneView payload.
- `src/i18n/` — English/Arabic locale provider and copy.
- `src/components/` — cinema, movie, seat, checkout, QR/history, offers, and handover UI.

## Prototype boundaries

- Checkout, cards, wallets, booking creation, refunds, and cancellation writes are simulated on-device.
- QR values contain only the booking reference.
- Offers are display-only and cannot be redeemed.
- Handover is a UI simulation; it makes no Genesys or OneView network call.
- `VITE_VISTA_BASE` enables a read-shaped live path only when the configured server safely injects credentials. Do not expose credentials in Vite environment variables.
