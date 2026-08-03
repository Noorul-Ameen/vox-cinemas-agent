import {
  apiErrorResponse,
  jsonResponse,
  listMonitoredConversations,
} from "../../_shared/monitoring.js";

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    return jsonResponse({
      ok: true,
      ...(await listMonitoredConversations(context.env, url.searchParams)),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
