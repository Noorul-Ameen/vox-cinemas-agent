# VOXi final hosted validation evidence

Date: 23 July 2026, UAE

Production URL: <https://voxi-ai.pages.dev/>

Commit preview: <https://97288d6a.voxi-ai.pages.dev/>

Release commit: `f4a77c5e9ac9006c6500071f9cf8dd431ff1038b`

Cloudflare deployment: `97288d6a-0312-4d6f-a393-ebd5a5db58cd`

## Deployment parity

- Cloudflare deployment status: SUCCESS.
- Production branch: `main`.
- Production commit: `f4a77c5`.
- Production asset: `/assets/index-En0aJL-F.js`.
- Commit-preview asset: `/assets/index-En0aJL-F.js`.
- Production and preview snapshot marker: `20260723-ba0d4226e0bb646c`.
- Hosted JavaScript bytes: 891,001.
- Hosted gzip bytes: 253,744.
- Hosted Brotli bytes: 228,320.
- Old snapshot marker: absent.
- The production root serves the current release without a deployment query parameter.

## Hosted text and booking replay

- Production root loaded in text mode without microphone permission: PASS.
- French movies at Mall of the Emirates tomorrow returned a truthful no-result state: PASS.
- `Anything is fine` cleared only the unavailable language: PASS.
- Mall of the Emirates and 24 July remained selected: PASS.
- 12 available movies rendered after contextual recovery: PASS.
- Exact request for Minions & Monsters at Mall of the Emirates tomorrow at 8:10 PM: PASS.
- Correct 20:10 KIDS seat map rendered: PASS.
- E1, E2, and E4 selection: PASS.
- Three seats and AED 126 total: PASS.
- Checkout movie, cinema, showtime, seats, and total: PASS.
- Refund FAQ hid checkout while retaining the journey: PASS.
- Grounded refund-policy guidance rendered: PASS.
- Return to checkout restored the same summary: PASS.
- Arabic and English switching retained checkout, E1, E2, E4, and AED 126: PASS.
- Screen label rendered without a stray zero: PASS.

## Hosted language replay

- Visible Arabic language selection changed the interface route: PASS.
- Arabic input rendered correctly: PASS.
- Existing Mall of the Emirates, date, and movie-card context remained available: PASS.
- Arabic and English use the same validated discovery and booking logic: PASS BY REPOSITORY CONTRACT.

## Hosted voice status

Controlled-browser voice failure and recovery: **PASS**. Controlled Chrome blocked microphone access. After the configured permission window, the widget showed `Microphone access is blocked. Allow microphone access for this site, then try again.`, re-enabled the voice control, and retained checkout with E1, E2, E4, and AED 126.

Repository validators for WebRTC, WebSocket, bounded startup and shutdown, stale-attempt retirement, recovery, explicit language routing, and protected ElevenLabs configuration pass. The ElevenLabs contract `2026-07-23.1` was published and read back. No successful live microphone conversation is claimed in this log.

Required follow-up:

1. Repeat English and Arabic startup in a normal HTTPS browser with a real microphone.
2. Speak a discovery request, select a movie and showtime, complete seats, ask an FAQ, and restore checkout.
3. Listen to the English and Arabic responses and record acoustic acceptance.

## Hosted conclusion

Cloudflare deployment parity, current snapshot delivery, text discovery, contextual no-result recovery, exact booking, seat-derived checkout, FAQ continuity, seat editing, bilingual interface routing, 420 px rendering, and controlled-browser voice failure recovery passed. Acoustic voice requires manual acceptance, and provider transactions remain blocked by external APIs.
