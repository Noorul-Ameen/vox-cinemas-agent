# VOXi cold-start remediation evidence

Date: 16 July 2026, UAE

Scope: local production candidate for the Cloudflare-hosted VOXi widget.

## Root cause

The deployed application loaded the complete showtime snapshot inside its initial JavaScript. The hosted asset was 4,905,829 bytes raw and 487,894 bytes gzip. This forced every visitor to download and parse 10,567 sessions before the landing widget could become interactive.

## Implementation

- Added a compact generated manifest for cinema, date, movie, media, and availability metadata.
- Generated content-versioned JSON shards for each nonempty cinema and programming date.
- Removed all runtime imports of `src/mockVistaData.js`.
- Added one-request Promise coalescing, memory reuse, browser `force-cache`, validation, and retry-safe error eviction.
- Kept the complete legacy data module for extractor and equivalence validation only.
- Moved small seat and booking fixtures into `src/mockTransactionData.js`.
- Deferred the unchanged ElevenLabs transport until text or voice interaction begins.
- Added a bilingual branded HTML loading shell that appears before React starts.
- Added immutable Cloudflare cache headers for content-versioned snapshot paths.
- Added a production build budget validator.
- Updated the daily refresh workflow to generate, validate, promote, roll back, and commit the manifest and shards atomically.

## Production build evidence

| Metric | Deployed baseline | Local candidate | Change |
| --- | ---: | ---: | ---: |
| Initial JavaScript raw | 4,905,829 bytes | 693,972 bytes | 85.9 percent smaller |
| Initial JavaScript gzip | 487,894 bytes | 196,789 bytes | 59.7 percent smaller |
| Initial JavaScript Brotli quality 5 | Not recorded | 179,727 bytes | Within 225 KiB budget |
| Initial application requests | 1 | 1 | No increase |
| Startup showtime requests | Embedded in JavaScript | 0 | Deferred until cinema and date are known |
| Startup ElevenLabs requests | Included in JavaScript | 0 | Deferred until text or voice starts |

Deferred ElevenLabs chunk: 551,482 bytes raw and 144,590 bytes gzip.

Snapshot version: `20260716-a584076046efc658`.

- 266 shards.
- 10,567 sessions.
- 36 movies.
- 22 cinemas.
- 18 programming dates.
- 3,760,624 total raw shard bytes.
- 54,902 raw bytes for the largest shard.
- 2,244 gzip bytes for the largest shard in the build budget check.

## Browser acceptance

Production preview URL: `http://localhost:4173/`

Viewport: 420 by 850 px.

- The initial asset inventory contained one script, `index-Cy7wA2Dp.js`.
- No ElevenLabs chunk or showtime shard appeared before interaction.
- Text chat connected after the first message, confirming deferred transport startup.
- The request `Show me family movies` rendered Minions & Monsters, Toy Story 5, and Supergirl for Mall of the Emirates on 16 July.
- After interaction, the inventory contained the ElevenLabs chunk and only the two cinema and date shards exercised by the test.
- A fresh 17 July shard and movie grid rendered in 351 ms.
- Returning to the cached 16 July grid rendered in 291 ms.
- All three displayed posters loaded successfully at 104 by 156 px.
- Body, widget, and conversation content had no horizontal overflow.
- Browser console errors and warnings: 0.

## Automated validation

Passed:

- Full `pnpm run validate` suite.
- Production `pnpm run build`.
- Snapshot source-to-shard equivalence.
- One-request shard coalescing and cache reuse.
- Seat metadata continuity after shard loading.
- Protected ElevenLabs EU residency and client-tool invariants.
- Voice startup and transport recovery validation.
- Customer-facing punctuation validation across 372 repository text files.
- Cold-load budgets for startup HTML, JavaScript, request count, deferred transport, shard size, snapshot size, and Cloudflare cache headers.

## Deployment status

The candidate has not yet been pushed or deployed during this task. The current Cloudflare URL continues to serve the older large bundle until the repository changes are published and the Cloudflare deployment completes.
