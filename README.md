# VOX Concierge — ElevenLabs Agent (StackBlitz edition)

Conversational VOX Cinemas agent that talks AND renders rich media (movie cards,
showtimes, seat map, booking). Uses the REAL ElevenLabs React SDK. Cinema data is
mock data in the real Vista Connect shapes, baked into the app so it runs as ONE
process — perfect for StackBlitz (no install/admin needed).

## Run on StackBlitz
1. Go to stackblitz.com and sign in (GitHub/Google/email).
2. New Project -> import this folder (drag-drop the unzipped folder or upload the zip).
3. StackBlitz auto-runs `npm install` then `npm run dev` and shows a live preview.
4. Add your ElevenLabs Agent ID: create a file named `.env` and put:
       VITE_AGENT_ID=agent_your_id_here
   Then restart (StackBlitz reloads automatically).
5. In the preview, tap the mic, allow the microphone, say "What's showing tonight?"

The app LOADS without an agent (you can click movies/seats manually). VOICE needs
the Agent ID.

## Go live on real Vista later
Set `VITE_VISTA_BASE=https://api-dev.maflec.com` in `.env` and add the Bearer token +
x-api-key in `src/vistaClient.js`. The app code doesn't change.

## Files
- src/App.jsx — widget + real ElevenLabs SDK + client tools
- src/vistaClient.js — data layer (mock now, real Vista later)
- src/mockVistaData.js — dummy data in real Vista shapes
- src/components/RichMedia.jsx — movie grid, showtimes, seat map, booking card
