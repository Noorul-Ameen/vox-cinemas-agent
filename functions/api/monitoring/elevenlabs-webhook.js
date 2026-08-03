import {
  apiErrorResponse,
  ingestElevenLabsWebhook,
  jsonResponse,
  verifyElevenLabsSignature,
} from "../../_shared/monitoring.js";

export async function onRequestPost(context) {
  try {
    const rawBody = await context.request.arrayBuffer();
    await verifyElevenLabsSignature(
      context.request,
      rawBody,
      context.env.ELEVENLABS_WEBHOOK_SECRET,
    );
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return jsonResponse({
        ok: false,
        error: { code: "invalid_json", message: "Webhook payload must be valid JSON." },
      }, 400);
    }
    return jsonResponse({
      ok: true,
      result: await ingestElevenLabsWebhook(context.env, payload, rawBody),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
