# Checkout continuity validation

Date: 16 July 2026, UAE

Build under test: local production preview at `http://127.0.0.1:4173/`

Push status: not pushed. This candidate is available locally for review first.

## Fixes verified

- An unpaid checkout is stored as an exact resumable snapshot with its checkout ID, order, movie, session, cinema, date, selected seats, seat plan, and quote.
- FAQ and general information questions keep checkout visible.
- Offers, repeated offer refinement, booking history, booking details, and cancellation review retain the unpaid checkout.
- A persistent English and Arabic return control appears whenever a temporary panel is shown.
- `return to checkout`, equivalent continuation wording, and Arabic checkout return wording restore the exact checkout locally for typed and voice transcript paths.
- Movie, cinema, date, showtime, experience, or seat changes still invalidate incompatible seats and pricing.
- Display-changing agent tools cannot silently replace an active checkout.
- Payment authorization locks the checkout against panel and pending-order displacement.
- Edit seats restores the exact seats. Seat changes recalculate ticket count, subtotal, fees, and total before a new checkout is created.
- Successful checkout removes the resumable draft and renders the saved booking summary and reference QR.

## Browser acceptance run

The mounted production build was exercised using this path:

1. Mall of the Emirates
2. 17 July 2026
3. Family movies
4. Toy Story 5
5. 18:30 PREMIER
6. Seats D5 and D6
7. Checkout total AED 84.00

Acceptance results:

- Refund FAQ during checkout: PASS. Checkout and Edit seats remained visible.
- Parking question during checkout: PASS. Checkout remained visible.
- Checkout to Offers: PASS. Return control displayed the correct movie, two seats, and AED 84.00.
- Repeated Emirates NBD offer refinement: PASS. The return target was not overwritten.
- Return control: PASS. Toy Story 5, 18:30, D5 and D6, and AED 84.00 were restored.
- Checkout to Booking History to stored booking detail: PASS. The unpaid checkout remained resumable.
- Typed `return to checkout`: PASS. The exact checkout was restored.
- Arabic language switch: PASS. Checkout remained mounted and translated.
- Arabic `العودة إلى الدفع`: PASS. The exact checkout was restored.
- Edit seats: PASS. D5 and D6 were restored as selected.
- Remove D6: PASS. Ticket count changed to one and the total changed to AED 42.00.
- Reconfirm D5: PASS. Checkout showed one seat and AED 42.00.
- Apple Pay preview: PASS. A saved booking summary and reference QR rendered.
- Local Arabic voice startup: PASS. Status reached Voice chat, and ending voice returned to Text chat with the current booking view intact.
- 420 by 850 layout: PASS. Document width was 420 px, widget width was 388 px, and horizontal overflow was false.
- Runtime console errors: PASS. No browser error entries were recorded.

The normal WebSocket close warning appeared when the voice session was deliberately ended. No application error was recorded.

## Automated evidence

- `pnpm run validate:checkout-continuity`: PASS
- `pnpm run validate`: PASS
- `pnpm run build`: PASS
- Customer-facing em dash and en dash scan across 375 repository text files: PASS
- Current schedule validation: 10,567 sessions, 36 films, 22 cinemas, 16 July through 5 August 2026: PASS

Voice transcript routing is covered by the same local classifier and restoration helper as typed routing. The focused validator asserts both SDK transcript and typed message paths. No ElevenLabs client-tool name, WebRTC setting, EU residency setting, `select_seats` behavior, fuzzy resolver, or 420 px layout contract was changed.
