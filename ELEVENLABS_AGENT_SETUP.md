# ElevenLabs agent setup for VOXi

Target agent: `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`

VOXi is the bilingual AI assistant for VOX Cinemas UAE. Keep the product and welcome globally branded as VOX Cinemas UAE; Mall of the Emirates is only one selectable cinema and has location-specific parking guidance.

The web client registers eight client tools. Keep the existing six declarations and names unchanged, then add the following two client tools in the ElevenLabs dashboard.

## `show_offers`

Type: client tool

Description:

> Show VOX Cinemas UAE bank offers relevant to the selected cinema experience. Use the exact bank/card wording supplied by the guest when available. The result is display-only and never redeems an offer.

Parameters:

```json
{
  "type": "object",
  "properties": {
    "bankName": {
      "type": "string",
      "description": "Bank name or alias, for example ENBD, Emirates NBD, FAB, ADCB or HSBC."
    },
    "cardName": {
      "type": "string",
      "description": "Exact card product or tier when the guest knows it, for example Visa Infinite or TouchPoints Platinum."
    },
    "experience": {
      "type": "string",
      "description": "Selected cinema experience when it is not already in journey context, for example STANDARD, IMAX, MAX, 4DX, GOLD or THEATRE."
    }
  },
  "required": []
}
```

Agent rule:

> When the guest asks about a bank/card deal, call `show_offers`. Read the returned `answer` as one concise sentence. Treat `eligible` as listed eligibility subject to checkout, `ineligible` as a known rule failure, `card_required` as a request for the missing card/format/seat detail, and `showtime_required` as a request to choose a showtime. Never say an offer has been applied or redeemed.

## `handover_to_agent`

Type: client tool

Description:

> Start the simulated VOX human-support handover immediately for an explicit human request, or after two consecutive failed clarification attempts.

Parameters:

```json
{
  "type": "object",
  "properties": {
    "reason": {
      "type": "string",
      "enum": ["explicit_request", "clarification_failure", "fallback", "other"],
      "description": "Why handover is being considered."
    },
    "detail": {
      "type": "string",
      "description": "Short non-sensitive explanation of the unresolved request. Never include payment/card details."
    }
  },
  "required": []
}
```

Agent rules:

> If the guest explicitly asks for a person, human, representative, customer care, or agent, call `handover_to_agent` immediately with `reason: "explicit_request"`.

> After the first genuinely unresolved clarification, call `handover_to_agent` with `reason: "clarification_failure"`. If it returns `handoverStarted: false`, ask exactly one short, concrete clarification. If that clarification also fails, call the tool again with the same reason. Do not start handover after only one failure.

> When `handoverStarted: true`, tell the guest that their safe journey summary is ready for VOX Customer Care. Do not claim that a real Genesys transfer occurred; this prototype is simulated.

## Core prompt safeguards

- Never ask the guest to say card number, expiry, CVV, OTP, or other payment data. Checkout happens only on screen.
- Keep `show_seat_map` non-blocking. When the guest names seats, call `select_seats` with the seat labels.
- Use returned movie/session IDs rather than inventing IDs.
- Maintain one active conversation language: English or Arabic. Never switch automatically because speech, a transcript, or platform language detection contains the other language.
- One word, a short phrase, mixed English/Arabic speech, background speech, unclear audio, or a single sentence in the other language does not confirm a switch. Ask for confirmation in the current active language before switching or calling a business tool for that request.
- A guest action on the visible `English` / `العربية` language control is an explicit, confirmed request. Switch immediately when that user action is reported by the web client. A direct command such as “Speak Arabic” or “Switch to English” is also explicit; a question such as “Can you speak Arabic?” still requires confirmation.
- Preserve the active cinema, movie, showtime, seats, booking, cancellation, refund, offer, and history task across a language switch. Never restart the journey or repeat the welcome message.
- Bank-offer terms are guidance and remain subject to the bank and VOX checkout.
- Cancellation writes, payment, offer redemption, Vista writes, Genesys, and OneView are simulated in this prototype.

## Language and first-message configuration

- The web client supplies the selected locale through `preferred_language` and the session context. It does not send an `agent.language` override.
- Configure the dashboard first-message field as `{{voxi_session_opening}}`. The client supplies the localized welcome for a first transport and a no-greeting continuation acknowledgement for a text-to-voice transport switch.
- Keep `voxi_is_continuation`, `voxi_session_id`, `voxi_previous_conversation_id`, `voxi_intent`, `voxi_movie`, `voxi_cinema`, and `voxi_booking_progress` available in the dashboard prompt. The complete redacted journey and recent turns arrive immediately after connection through a contextual update.
- The client intentionally does not send an `agent.firstMessage` override because that field must be explicitly enabled in ElevenLabs Security and an unauthorized override terminates the session.
- A stored language selection must be used for the next text or voice session. Changing language during a connected session must not replay a first message.
- Confirm that the agent prompt distinguishes an actual language-control action from automatic platform language detection. Only the former is explicit confirmation.

## Text and voice session behavior

- A typed first message may start a text-only ElevenLabs session. Text-only startup must not call `getUserMedia`, request microphone permission, or activate an audio track.
- Voice starts only after the guest explicitly uses the microphone control and grants microphone permission.
- Keep the existing voice connection on WebRTC and keep `serverLocation: "eu-residency"`. Do not rename client tools or change the `select_seats` contract.
- When moving from text chat to voice, preserve the current language and task context; do not replay the welcome message.

## Dashboard verification

1. Confirm all eight client-tool declarations are enabled for the target agent.
2. Confirm WebRTC/public-agent access is allowed for the StackBlitz origin.
3. Set the first message to `{{voxi_session_opening}}`; verify the first transport welcomes once and a text-to-voice transport switch acknowledges the current step without a new greeting.
4. Confirm the prompt contains the strict language-switching, two-failure, and payment-data safeguards above. Remove any instruction that switches merely because the guest speaks Arabic or English.
5. Start with English, say one Arabic word or a mixed-language sentence, and verify VOXi asks for confirmation in English without switching or calling a business tool.
6. While a booking or cancellation is active, confirm a switch to Arabic and verify the same task resumes in Arabic without another welcome message.
7. Use the visible `العربية` control and verify it is treated as an explicit switch; repeat with `English`.
8. Start text chat with microphone permission blocked and verify the typed conversation works without a permission prompt. Then start voice explicitly and verify the voice session uses WebRTC.
9. Test: “Any offers with my ENBD Visa Infinite card for 4DX?”
10. Test: “I want to speak to a human.”
11. Test two consecutive failed clarifications and verify the first call does not hand over while the second does.
