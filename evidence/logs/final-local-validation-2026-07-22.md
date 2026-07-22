# VOXi final local validation evidence

Date: 22 July 2026, UAE

Scope: current local candidate before hosted revalidation

## Data candidate

- Snapshot: `20260722-730239f0d90074fb`.
- Coverage: 2026-07-22 through 2026-08-12.
- Sessions: 11,126.
- Films: 43.
- Cinemas: 22.
- Remaining sessions on 22 July at refresh time: 421.
- Sessions on 23 July: 1,397.
- Schedule shards: 341.
- Official movie-information records: 94.
- Verified runtimes: 93.
- Missing posters: 0.
- Experience-media records: 14.

## Automated results

- Full `npm run validate`: PASS.
- `npm run build`: PASS.
- Final release asset: `/assets/index-B_jpqGCb.js`.
- Raw JavaScript: 897,497 bytes.
- Gzip JavaScript: 252,450 bytes.
- Brotli JavaScript: 228,683 bytes.

## Local browser results

- Missing-date Yas Mall IMAX availability truth guard: PASS.
- Jana Nayagan and Toxic language-variant handling: PASS.
- Arabic mixed-script movie-title handling: PASS.
- Retained discovery heading, movie notice, error, and showtime notice localization in both directions: PASS.
- Active-language no-op protection and lazy-chunk full-reload recovery: PASS.
- Family filtering at Mall of the Emirates tomorrow around 8 PM: PASS.
- Nearby-time fallback when no exact showtime exists: PASS.
- Exact visible movie selection: PASS.
- Exact visible showtime selection: PASS.
- E1, E2, and E3 checkout with three tickets and AED 126 total: PASS.
- Parking FAQ detour and exact checkout restore: PASS.
- Cross-cinema FAQ data isolation: PASS.
- E1 to E4 replacement, producing E2, E3, and E4 at AED 126: PASS.
- Device-only summary and local-reference QR `WLP06WX`: PASS.
- Cancellation continuation by listed movie title: PASS.
- Hatta no-cinema response with nearby UAE alternatives: PASS.
- French language no-result without title mismatch: PASS.
- 21 promotions, 20 issuer groups, and detailed FAB offer rendering: PASS.
- English ElevenLabs WebRTC connection: PASS.
- Arabic ElevenLabs WebRTC connection: PASS.
- Browser error-level console entries: 0.
- Browser information and warning entries: expected transport lifecycle messages only.

## Visual evidence

- [Final local booking render](../screenshots/final-local-booking-render-2026-07-22.png)

## Remaining release checks

- Publish the current candidate.
- Record the final rebuilt asset name and confirm Cloudflare serves it.
- Confirm snapshot `20260722-730239f0d90074fb` on the hosted origin.
- Repeat the critical end-to-end journeys on Cloudflare.
- Recheck the 420 px layout, browser navigation, and console.
- Complete manual English and Arabic acoustic voice acceptance with real speech and audible output.

No hosted deployment or hosted parity claim is made in this log.
