import { requireCloudflareAccess } from "../_shared/monitoring.js";

export async function onRequest(context) {
  const access = await requireCloudflareAccess(context.request, context.env);
  if (!access.ok) return access.response;
  context.data.accessClaims = access.claims;
  return context.next();
}
