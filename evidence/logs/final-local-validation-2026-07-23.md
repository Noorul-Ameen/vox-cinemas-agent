# VOXi final local validation evidence

Date: 23 July 2026, UAE

Branch: `main`

Release commit: `1af1d1908545483ff9659288fc645fac7fdda6d9`

## Data candidate

- Snapshot: `20260723-180b0b07f8429acf`
- Coverage: 2026-07-23 through 2026-08-12
- Sessions: 10,606
- Films: 35
- Cinemas: 22
- Dates: 21
- Sessions today: 1,116
- Sessions tomorrow: 1,398
- Schedule shards: 320
- Official movie-information records: 83

## Automated results

- Full local validators: PASS
- Production build: PASS
- Local E2E: 23/23 PASS
- Package audit: no known production vulnerabilities
- Secret scan: clean

## Local journey coverage

- English and Arabic discovery: PASS
- Grounded movie rating and information answers: PASS
- Retained movie-list context: PASS
- Exact movie and showtime routing: PASS
- Seat-derived ticket count and preview totals: PASS
- Checkout, FAQ, and seat-edit continuity: PASS
- Journey-state and stale-state guards: PASS
- ElevenLabs transport contracts and bounded recovery: PASS
- Customer-facing punctuation validation: PASS

## ElevenLabs contract

- Contract: `2026-07-23.3`
- Published: PASS
- Read back: PASS
- Prompt SHA-256: `dc8d1af309c247a642c155e017e2b26b4caf1b3801c429f5f8a883ff5f3ca467`

## Local conclusion

The source, snapshot, validators, production build, and 23 local E2E scenarios passed. Acoustic English and Arabic recognition and audible output remain a human normal-browser acceptance gate. Live inventory, holds, payment, official ticket QR, provider cancellation, refund, and handover are not implemented.
