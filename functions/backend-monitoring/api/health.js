import {
  apiErrorResponse,
  jsonResponse,
  monitoringHealth,
} from "../../_shared/monitoring.js";

export async function onRequestGet(context) {
  try {
    return jsonResponse({ ok: true, health: await monitoringHealth(context.env) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
