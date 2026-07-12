# ElevenLabs agent setup for VOXi

Target agent: `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`

The web client registers eight client tools. Keep the existing six declarations and names unchanged, then add the following two client tools in the ElevenLabs dashboard.

## `show_offers`

Type: client tool

Description:

> Show VOX UAE bank offers relevant to the selected cinema experience. Use the exact bank/card wording supplied by the guest when available. The result is display-only and never redeems an offer.

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
- If the user speaks Arabic or switches the widget to Arabic, continue in Arabic; otherwise use English.
- Bank-offer terms are guidance and remain subject to the bank and VOX checkout.
- Cancellation writes, payment, offer redemption, Vista writes, Genesys, and OneView are simulated in this prototype.

## Dashboard verification

1. Confirm all eight client-tool declarations are enabled for the target agent.
2. Confirm WebRTC/public-agent access is allowed for the StackBlitz origin.
3. Confirm the prompt contains the two-failure and payment-data safeguards above.
4. Test: “Any offers with my ENBD Visa Infinite card for 4DX?”
5. Test: “I want to speak to a human.”
6. Test two consecutive failed clarifications and verify the first call does not hand over while the second does.

