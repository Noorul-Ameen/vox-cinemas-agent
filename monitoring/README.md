# Voxi backend monitoring

The monitoring dashboard is an independent Cloudflare Pages surface at
`/backend-monitoring/`. It does not import from, instrument, or modify the
customer-facing React application.

## Data flow

1. The dashboard requests operational records from Pages Functions under
   `/backend-monitoring/api/`.
2. The sync endpoint reads the EU-resident ElevenLabs conversation API and
   stores conversation metadata, tool calls, errors, and state transitions.
3. The signed webhook at `/api/monitoring/elevenlabs-webhook` retains future
   completed-session events even when the dashboard is closed.
4. D1 stores operational history without complete transcript text, card data,
   CVV values, message content, or raw tool parameters.

## Required Cloudflare configuration

Bind a dedicated D1 database as `VOXI_MONITORING_DB` and apply
`monitoring/migrations/0001_initial.sql`.

Configure these server-side values for production and preview:

| Name | Type | Purpose |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | Secret | Reads conversation records |
| `ELEVENLABS_WEBHOOK_SECRET` | Secret | Verifies signed webhook events |
| `ELEVENLABS_AGENT_ID` | Text | Limits ingestion to the Voxi agent |
| `ELEVENLABS_API_BASE` | Text | EU API base URL |
| `CF_ACCESS_TEAM_DOMAIN` | Text | Cloudflare Access issuer |
| `CF_ACCESS_AUD` | Secret | Cloudflare Access application audience |
| `MONITORING_ALLOWED_EMAILS` | Secret, optional | Additional email allowlist |
| `MONITORING_ALLOWED_EMAIL_DOMAINS` | Secret, optional | Additional domain allowlist |

Create a Cloudflare Access self-hosted application for
`voxi-ai.pages.dev/backend-monitoring/*`. The Pages middleware also validates
the Access JWT signature, issuer, audience, lifetime, and optional identity
allowlist. If Access configuration is absent, the page fails closed.

## ElevenLabs configuration

Use `https://api.eu.residency.elevenlabs.io` as `ELEVENLABS_API_BASE`. Register
the production webhook URL and enable these signed event types:

- `post_call_transcription`
- `post_call_transcription_otel`
- `call_initiation_failure`

The webhook secret must match `ELEVENLABS_WEBHOOK_SECRET` exactly.

## Retention and privacy

No automatic deletion is configured, so operational history remains available
across testing sessions. The database deliberately excludes complete
conversation text and sensitive checkout values. If an organizational
retention policy is introduced later, apply it to the D1 tables as a scheduled
maintenance operation.
