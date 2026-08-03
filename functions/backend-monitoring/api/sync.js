import {
  apiErrorResponse,
  jsonResponse,
  requireSameOrigin,
  syncElevenLabs,
} from "../../_shared/monitoring.js";

export async function onRequestPost(context) {
  try {
    requireSameOrigin(context.request);
    const result = await syncElevenLabs(context.env);
    return jsonResponse({ ok: true, sync: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
