# Cancellation continuation and movie render performance

Date: 2026-07-16

Base commit: `1e11096` (`Refresh VOX UAE showtimes`)

## Fixes verified

- A cancellation list now carries an explicit cancellation-target purpose and displayed candidate references.
- A unique displayed movie title opens that booking's cancellation confirmation.
- Two displayed bookings with the same title remain on the cancellation list and request a displayed booking reference.
- A displayed booking reference opens the exact matching cancellation confirmation.
- Text and normalized voice transcript paths use the same continuation resolver before movie discovery.
- `Toy Story five` resolves exactly to a displayed `Toy Story 5` booking.
- An explicit Back, new movie request, or FAQ can leave target selection instead of being trapped in cancellation.
- Snapshot discovery now uses one lazy index by cinema, programming date, and movie.
- The two artificial 200 ms discovery delays were removed.

## Automated validation

- Full `pnpm run validate`: PASS, including 36 films, 22 cinemas, 10,567 sessions, 18 dates, cancellation safety, text and voice routing parity, 420 px invariants, and customer-facing punctuation.
- `pnpm run build`: PASS.
- Production output: `dist/assets/index-DQNvNBGW.js`, 4,928.30 kB raw and 509.48 kB gzip.
- Deterministic index validation: PASS. Repeated movie lookups do not rescan the source session catalog.
- Exhaustive index equivalence: PASS across 396 film queries and 2,297 session queries.

## Mounted production-preview validation

The local production build was tested at `http://127.0.0.1:4173/` with a 420 by 850 viewport.

- Unique-title cancellation continuation: PASS.
- Duplicate-title disambiguation: PASS.
- Exact displayed-reference continuation: PASS.
- Cinema picker remained hidden during cancellation continuation: PASS.
- Movie picker remained hidden during cancellation continuation: PASS.
- Five movie render timings: 392 ms, 344 ms, 328 ms, 333 ms, and 343 ms.
- Median: 343 ms.
- Maximum: 392 ms.
- Previous hosted measurement before the fix: 2,143 ms.
- Horizontal overflow at 420 px: none.
- Visible poster dimensions: 104 by 156 CSS pixels, with valid 274 by 385 source images.
- Browser console errors or warnings: none.

## Remaining boundary

The generated showtime snapshot is still embedded in one production JavaScript bundle. The interaction delay is fixed, but a first visit on a slow connection can still be affected by the approximately 509 kB gzip download and JavaScript parsing. Date and cinema JSON sharding is a separate data-pipeline change.

The mounted cancellation test used text input. Voice parity is verified at the shared routing and normalized transcript level, including the observed ElevenLabs user-message event shape and spoken number normalization. A live microphone was not required for this local routing test.

These changes are local until they are committed, pushed, and deployed.
