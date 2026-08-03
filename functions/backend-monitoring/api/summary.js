import {
  apiErrorResponse,
  jsonResponse,
  monitoringSummary,
} from "../../_shared/monitoring.js";

export async function onRequestGet(context) {
  try {
    return jsonResponse({ ok: true, summary: await monitoringSummary(context.env) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
