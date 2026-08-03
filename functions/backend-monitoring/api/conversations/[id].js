import {
  apiErrorResponse,
  jsonResponse,
  monitoredConversationDetail,
} from "../../../_shared/monitoring.js";

export async function onRequestGet(context) {
  try {
    return jsonResponse({
      ok: true,
      ...(await monitoredConversationDetail(context.env, context.params.id)),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
