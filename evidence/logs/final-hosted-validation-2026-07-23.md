# VOXi final hosted validation evidence

Date: 23 July 2026, UAE

Production URL: <https://voxi-ai.pages.dev/>

Branch: `main`

Validated runtime and data source commit: `4797e37c38e2d20ce7d7e7bf18d9898b78c89e79`

## Deployment parity

- Functional production `release.json` commit: `4797e37c38e2d20ce7d7e7bf18d9898b78c89e79`
- Production `release.json` snapshot: `20260723-08c005696287764d`
- Exact commit match: PASS
- Exact snapshot match: PASS
- Hosted asset: `/assets/index-CUILGygO.js`
- Hosted JavaScript bytes: 889,919
- Immutable cache policy: PASS

## Hosted automated results

- Exact-commit smoke: 1/1 PASS
- Hosted E2E: 23/23 PASS
- Manual [Refresh VOX UAE showtimes run #13](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30008195281): PASS in 2m41s, data commit published
- [Validate VOXi run #4](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30008628943): PASS in 1m29s against the data commit
- Both release artifact upload steps: `actions/upload-artifact` v7.0.1 pinned SHA
- Prior Node 20 artifact warning: removed
- [Validate VOXi run #7](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30009245035): PASS without annotations in 1m27s
- [Hosted VOXi smoke run #7](https://github.com/Noorul-Ameen/vox-cinemas-agent/actions/runs/30009356648): PASS in 45s

## Hosted data

- Sessions: 10,388
- Films: 35
- Cinemas: 22
- Dates: 21, through 2026-08-12
- Sessions today: 817
- Sessions tomorrow: 1,408
- Schedule shards: 320
- Official movie-information records: 83

## Live Chrome results

- Arabic rating query: PASS
- Movie list remained visible: PASS
- Compact official poster rendering in signed-in Chrome: PASS
- Controlled microphone denial: PASS
- Recovery completed after 45 seconds: PASS
- Active state retained after recovery: PASS

## Visual evidence

- [Signed-in Chrome poster and compact movie-card rendering](../screenshots/final-hosted-signed-in-chrome-2026-07-23.png)
- [Hosted Arabic rating answer with the movie list retained](../screenshots/final-hosted-arabic-rating-2026-07-23.png)

## ElevenLabs hosted status

- Contract `2026-07-23.3` published: PASS
- Contract read back: PASS
- Prompt SHA-256: `dc8d1af309c247a642c155e017e2b26b4caf1b3801c429f5f8a883ff5f3ca467`

The controlled denial test validates recovery and state retention. Acoustic English and Arabic speech recognition and audible output remain a human normal-browser acceptance gate. Public authentication or origin allowlisting and conversation-data retention remain governance gates.

## Hosted conclusion

Production release identity, immutable asset delivery, exact-commit smoke, hosted E2E, Arabic rating behavior, movie-list retention, and controlled microphone-denial recovery passed. Offers still require official checkout verification. Live inventory, holds, payment, official ticket QR, provider cancellation, refund, and handover are unavailable because the required provider APIs are not integrated.
