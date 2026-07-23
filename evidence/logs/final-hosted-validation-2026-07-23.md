# VOXi final hosted validation evidence

Date: 23 July 2026, UAE

Production URL: <https://voxi-ai.pages.dev/>

Branch: `main`

Validated runtime source commit: `1af1d1908545483ff9659288fc645fac7fdda6d9`

## Deployment parity

- Functional test deployment `release.json` commit: `1af1d1908545483ff9659288fc645fac7fdda6d9`
- Production `release.json` snapshot: `20260723-180b0b07f8429acf`
- Exact commit match: PASS
- Exact snapshot match: PASS
- Hosted asset: `/assets/index-DqBCeyow.js`
- Hosted JavaScript bytes: 889,938
- Immutable cache policy: PASS

## Hosted automated results

- Exact-commit smoke: 1/1 PASS
- Hosted E2E: 23/23 PASS

## Hosted data

- Sessions: 10,606
- Films: 35
- Cinemas: 22
- Dates: 21, through 2026-08-12
- Sessions today: 1,116
- Sessions tomorrow: 1,398
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
