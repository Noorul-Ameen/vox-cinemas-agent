# Hosted acceptance: 15 July 2026

Historical evidence only. Superseded by `evidence/logs/hosted-e2e-2026-07-16.md` and `docs/end-to-end-test-report.md`.

Target: <https://voxi-ai.pages.dev/>
Repository: `Noorul-Ameen/vox-cinemas-agent`

## Revision and artifact identity

The accepted `main` history includes:

- application revision `4605dc4`;
- refresh workflow revision `5a50d39`;
- voice CSP revision `46648b5`;
- Actions-runtime revision `5e73c1d`;
- first generated-data refresh commit `76496b7`;
- current updated-runtime refresh commit `1cf0d56`.

Cloudflare served:

```text
/assets/index-D4Y0PLpS.js
bytes: 4541586
SHA-256: D704F5665F3792FE525BFC8DD6E69D84EE7A7E396A3C45D7F6391B106307C6AB
local/deployed bytes: identical
root document: HTTP 200
rawAudioProcessor.js: HTTP 200
audioConcatProcessor.js: HTTP 200
```

This proves application-artifact parity between the locally inspected 420 px white/blue build and Cloudflare. It does not convert device-local checkout references into live VOX transactions.

The final refresh commit changed only generated schedule data. The voice implementation tested in signed-in Chrome was unchanged, and the protected voice contract was rerun as part of the final 24-validator suite.

## Hosted voice

Signed-in Chrome with microphone permission passed:

```text
status: Voice chat
agent greeting: received
active control: End voice
console warnings: 0
console errors: 0
```

The primary ElevenLabs worklets are self-hosted. ElevenLabs React 0.7.1 creates a secondary WebRTC output-capture worklet that ignores `workletPaths`, so CSP deliberately allows `blob:` in `script-src` while continuing to block `data:`. WebRTC, `serverLocation: "eu-residency"`, protected client-tool names and `select_seats` are unchanged.

This is a successful English desktop Chrome voice smoke test. Arabic spoken and broader physical mobile/browser acceptance remain production gates.

## Hosted text and rendering

Query:

```text
What is playing at Mall of the Emirates tomorrow at 6 PM?
```

Observed relevant results:

- Toy Story 5: 17:45, KIDS;
- The Odyssey: 18:00 and 18:15;
- Match: 18:10.

The result retained the supplied cinema, date and preferred time instead of listing the full day. Poster cards measured approximately 104 × 156 px and remained contained. Back/Forward navigation passed. The tested local build had the same Cloudflare bundle bytes and passed white/blue styling with no document-level overflow at 420 px.

Arabic/RTL family and near-time filtering also passed at 420 px without overflow. The hosted Arabic booking path completed with:

```text
movie/session: Toy Story 5, 17:45, KIDS
selected seats: A1, A2, A4
ticket count: 3
total: AED 126
checkout Back: all three seats preserved
masked demo card: accepted after returning to checkout
confirmation reference: WLZWP6P
confirmation QR: rendered
seat map after confirmation: removed
```

The two-step local-only cancellation then passed. The booking card changed to cancelled and both the QR and cancellation action were removed. Voice, discovery, booking and cancellation acceptance produced zero console warnings or errors.

## Refresh automation

[GitHub Actions run 29397059917](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/29397059917) completed end to end on `checkout@v7`, `setup-node@v7` and `setup-python@v6`:

- official public-site extraction;
- freshness/completeness/data validation;
- generated client module validation;
- `pnpm run validate` with all 24 repository validators and `pnpm run build`;
- changed-data commit and push.

Current generated data validates:

```text
extractedAt: 2026-07-15T07:21:28.186Z
raw sessions: 9499
sessions: 9460
duplicates removed: 39
2026-07-16 sessions: 1438
films: 35
cinemas: 22
programming dates: 7
range: 2026-07-16..2026-07-22
experience-media records: 14
offer-media records: 20
```

The run committed refreshed data as `1cf0d56`. The workflow remains scheduled daily at 01:30 UTC and additionally on Thursday at 06:30 UTC. The earlier [run 29396366283](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/29396366283) also completed the full path successfully.

## Screenshot evidence

- `evidence/screenshots/hosted-white-blue-july16-420.png`: English exact cinema/date/time results and contained posters.
- `evidence/screenshots/hosted-arabic-family-july16-420.png`: Arabic/RTL family and near-time results.
- `evidence/screenshots/hosted-booking-qr-arabic-420.png`: Arabic confirmation, reference QR and cleaned seat-map state.
- `evidence/screenshots/hosted-cancelled-booking-arabic-420.png`: cancelled booking card with QR/action cleanup.

## Readiness boundary

The hosted experience is ready for leadership review of schedule discovery, voice startup, seat selection, checkout presentation, QR rendering and local-only cancellation. Reference `WLZWP6P`, the QR, saved demo card and cancellation state are device-local presentation evidence, not official tickets, payments, refunds or booking writes. Live customer sales remain blocked until licensed inventory holds, authoritative quotes, PCI payment, booking/ticket, cross-device lookup, cancellation/refund and redemption APIs are enabled and approved.
