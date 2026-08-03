const ACCESS_CERT_TTL_MS = 60 * 60 * 1000;
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
const MAX_WEBHOOK_BYTES = 5 * 1024 * 1024;
const LIST_PAGE_SIZE = 20;

export const KNOWN_TOOLS = [
  "show_movie_selection",
  "show_showtimes",
  "show_seat_map",
  "select_seats",
  "show_booking_summary",
  "show_booking_for_cancellation",
  "show_offers",
  "handover_to_agent",
];

const BOOKING_TOOLS = [
  "show_movie_selection",
  "show_showtimes",
  "show_seat_map",
  "select_seats",
  "show_booking_summary",
];

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS conversations (
    conversation_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    agent_name TEXT,
    status TEXT NOT NULL DEFAULT 'unknown',
    started_at INTEGER,
    ended_at INTEGER,
    duration_seconds REAL,
    message_count INTEGER DEFAULT 0,
    call_successful INTEGER,
    language TEXT,
    channel TEXT,
    intent TEXT,
    booking_progress TEXT,
    termination_reason TEXT,
    environment TEXT,
    branch_id TEXT,
    version_id TEXT,
    tool_total INTEGER DEFAULT 0,
    tool_success_count INTEGER DEFAULT 0,
    tool_error_count INTEGER DEFAULT 0,
    tool_pending_count INTEGER DEFAULT 0,
    expected_missing_count INTEGER DEFAULT 0,
    latest_error_code TEXT,
    latest_error_message TEXT,
    source TEXT NOT NULL,
    first_seen_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_synced_at INTEGER,
    details_synced_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_started_at
    ON conversations(started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_status
    ON conversations(status, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_issues
    ON conversations(tool_error_count, expected_missing_count, started_at DESC)`,
  `CREATE TABLE IF NOT EXISTS tool_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    tool_call_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    sequence_number INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    started_offset_ms INTEGER,
    duration_ms INTEGER,
    parameter_keys TEXT,
    result_summary TEXT,
    error_code TEXT,
    error_message TEXT,
    source TEXT NOT NULL,
    first_seen_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(conversation_id, tool_call_id),
    FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tool_activity_conversation
    ON tool_activity(conversation_id, sequence_number)`,
  `CREATE INDEX IF NOT EXISTS idx_tool_activity_status
    ON tool_activity(status, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS expected_tools (
    conversation_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    expectation TEXT NOT NULL,
    observed_status TEXT NOT NULL,
    reason TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(conversation_id, tool_name),
    FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_expected_tools_missing
    ON expected_tools(expectation, observed_status, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS interaction_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_key TEXT NOT NULL UNIQUE,
    conversation_id TEXT,
    created_at INTEGER NOT NULL,
    level TEXT NOT NULL,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    details_json TEXT,
    FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_interaction_logs_conversation
    ON interaction_logs(conversation_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_interaction_logs_level
    ON interaction_logs(level, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS webhook_receipts (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    conversation_id TEXT,
    received_at INTEGER NOT NULL,
    processed_at INTEGER,
    processing_status TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sync_state (
    state_key TEXT PRIMARY KEY,
    state_value TEXT,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_runs (
    run_id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    pages_processed INTEGER NOT NULL DEFAULT 0,
    conversations_seen INTEGER NOT NULL DEFAULT 0,
    details_loaded INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    error_message TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at
    ON sync_runs(started_at DESC)`,
];

const schemaReady = new WeakSet();
const accessCertificateCache = new Map();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

class MonitoringError extends Error {
  constructor(message, status = 500, code = "monitoring_error") {
    super(message);
    this.name = "MonitoringError";
    this.status = status;
    this.code = code;
  }
}

function headers(extra = {}) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers(extraHeaders),
  });
}

export function apiErrorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = safeToken(error?.code) || "internal_error";
  const message = status >= 500
    ? "The monitoring service could not complete this request."
    : redactText(error?.message || "The request could not be completed.", 180);
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

function getDb(env) {
  if (!env?.VOXI_MONITORING_DB) {
    throw new MonitoringError(
      "The monitoring database binding is not configured.",
      503,
      "database_not_configured",
    );
  }
  return env.VOXI_MONITORING_DB;
}

export async function ensureSchema(env) {
  const db = getDb(env);
  if (schemaReady.has(db)) return db;
  await db.batch(SCHEMA_STATEMENTS.map((statement) => db.prepare(statement)));
  schemaReady.add(db);
  return db;
}

function base64UrlBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJwtSegment(value) {
  return JSON.parse(decoder.decode(base64UrlBytes(value)));
}

function normalizeTeamDomain(value) {
  const trimmed = String(value || "").trim().replace(/\/$/, "");
  if (!trimmed) return "";
  return /^https:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function getAccessCertificates(teamDomain) {
  const cached = accessCertificateCache.get(teamDomain);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new MonitoringError(
      "Cloudflare Access certificates could not be loaded.",
      503,
      "access_certificates_unavailable",
    );
  }
  const payload = await response.json();
  const keys = Array.isArray(payload?.keys) ? payload.keys : [];
  if (!keys.length) {
    throw new MonitoringError(
      "Cloudflare Access did not return signing keys.",
      503,
      "access_certificates_missing",
    );
  }
  accessCertificateCache.set(teamDomain, {
    keys,
    expiresAt: Date.now() + ACCESS_CERT_TTL_MS,
  });
  return keys;
}

function audienceMatches(claimAudience, expectedAudience) {
  if (Array.isArray(claimAudience)) return claimAudience.includes(expectedAudience);
  return claimAudience === expectedAudience;
}

function allowedIdentity(claims, env) {
  const email = String(claims?.email || "").trim().toLowerCase();
  const emails = String(env.MONITORING_ALLOWED_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const domains = String(env.MONITORING_ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  if (!emails.length && !domains.length) return true;
  if (!email) return false;
  if (emails.includes(email)) return true;
  const domain = email.split("@")[1] || "";
  return domains.includes(domain);
}

export async function requireCloudflareAccess(request, env) {
  const teamDomain = normalizeTeamDomain(env?.CF_ACCESS_TEAM_DOMAIN);
  const expectedAudience = String(env?.CF_ACCESS_AUD || "").trim();
  if (!teamDomain || !expectedAudience) {
    return {
      ok: false,
      response: jsonResponse({
        ok: false,
        error: {
          code: "secure_access_not_configured",
          message: "Backend monitoring is unavailable until secure access is configured.",
        },
      }, 503),
    };
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) {
    return {
      ok: false,
      response: jsonResponse({
        ok: false,
        error: { code: "access_required", message: "Secure backend access is required." },
      }, 401),
    };
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("invalid token format");
    const jwtHeader = decodeJwtSegment(parts[0]);
    const claims = decodeJwtSegment(parts[1]);
    if (jwtHeader.alg !== "RS256" || !jwtHeader.kid) throw new Error("unsupported token");

    const keys = await getAccessCertificates(teamDomain);
    const jwk = keys.find((candidate) => candidate.kid === jwtHeader.kid);
    if (!jwk) throw new Error("signing key not found");
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const verified = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      base64UrlBytes(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );

    const now = Math.floor(Date.now() / 1000);
    const issuer = String(claims.iss || "").replace(/\/$/, "");
    if (!verified) throw new Error("signature verification failed");
    if (issuer !== teamDomain) throw new Error("issuer mismatch");
    if (!audienceMatches(claims.aud, expectedAudience)) throw new Error("audience mismatch");
    if (!Number.isFinite(claims.exp) || claims.exp <= now) throw new Error("token expired");
    if (Number.isFinite(claims.nbf) && claims.nbf > now + 30) throw new Error("token not active");
    if (!allowedIdentity(claims, env)) throw new Error("identity not allowed");

    return { ok: true, claims };
  } catch {
    return {
      ok: false,
      response: jsonResponse({
        ok: false,
        error: { code: "access_denied", message: "Secure backend access was denied." },
      }, 403),
    };
  }
}

export function requireSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  if (new URL(origin).origin !== new URL(request.url).origin) {
    throw new MonitoringError("Cross-origin writes are not allowed.", 403, "origin_denied");
  }
}

function safeToken(value, fallback = "") {
  const token = String(value ?? "").trim();
  return /^[a-zA-Z0-9_.:-]{1,120}$/.test(token) ? token : fallback;
}

function redactText(value, maximumLength = 240) {
  if (value === null || value === undefined) return null;
  let text = typeof value === "string" ? value : JSON.stringify(value);
  text = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/\b(?:\d[ -]*?){7,19}\b/g, "[redacted number]")
    .replace(/\b(?:cvv|cvc|security code)\s*[:=]?\s*\d{3,4}\b/gi, "$1 [redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maximumLength);
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function epochMilliseconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric < 1e12 ? Math.round(numeric * 1000) : Math.round(numeric);
}

function normalizeSuccessful(value) {
  if (value === true || value === 1 || value === "success" || value === "successful") return 1;
  if (value === false || value === 0 || value === "failure" || value === "failed") return 0;
  return null;
}

function normalizeLanguage(value, userText) {
  const language = String(value || "").trim().toLowerCase();
  if (language.startsWith("ar") || /arabic|العربية/.test(language)) return "ar";
  if (language.startsWith("en") || language === "english") return "en";
  if (/[؀-ۿ]/.test(userText)) return "ar";
  return userText ? "en" : null;
}

function normalizeStatus(value, eventType) {
  if (eventType === "call_initiation_failure") return "failed";
  const status = safeToken(String(value || "unknown").toLowerCase(), "unknown");
  return status || "unknown";
}

function classifyIntent(userText, dynamicVariables) {
  const explicit = String(firstValue(
    dynamicVariables.voxi_intent,
    dynamicVariables.intent,
  ) || "").toLowerCase();
  if (explicit) return safeToken(explicit, "unknown");

  const text = userText.toLowerCase();
  if (!text) return "unknown";
  if (/(cancel|refund|إلغاء|الغاء|استرداد)/i.test(text)) return "cancellation";
  if (/(offer|discount|bank|card deal|عرض|خصم|بطاقة|بنك)/i.test(text)) return "offers";
  if (/(human|agent|representative|person|موظف|وكيل|شخص)/i.test(text)) return "handover";
  if (/(booking reference|my booking|booking history|حجزي|رقم الحجز|حجوزاتي)/i.test(text)) {
    return "booking_summary";
  }
  if (/(movie|cinema|showtime|seat|book|film|فيلم|سينما|موعد|مقعد|احجز|حجز)/i.test(text)) {
    return "booking";
  }
  return "faq";
}

function progressRank(progress) {
  const normalized = String(progress || "").toLowerCase();
  if (/confirm|payment|summary/.test(normalized)) return 4;
  if (/seat.selected|seat_selected|selected_seat/.test(normalized)) return 3;
  if (/seat/.test(normalized)) return 2;
  if (/showtime|time/.test(normalized)) return 1;
  if (/movie|cinema|date/.test(normalized)) return 0;
  return -1;
}

function resultPayload(value) {
  if (typeof value !== "string") return value;
  if (value.length > 50000) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toolFailure(result) {
  const parsed = resultPayload(result);
  const object = asObject(parsed);
  const failed = object.is_error === true
    || object.error === true
    || object.success === false
    || String(object.status || "").toLowerCase() === "error";
  if (!failed) return null;
  return {
    code: safeToken(firstValue(object.error_code, object.code), "tool_error"),
    message: redactText(firstValue(object.error_message, object.message, object.error), 240)
      || "The tool returned an error.",
  };
}

function parameterKeys(call) {
  const parameters = asObject(firstValue(call.params, call.parameters, call.arguments));
  return Object.keys(parameters).sort().slice(0, 40);
}

function parseTranscriptTools(transcript) {
  const calls = [];
  const callsById = new Map();
  let sequence = 0;

  for (const turn of transcript) {
    for (const call of asArray(turn?.tool_calls)) {
      const name = safeToken(firstValue(call.tool_name, call.name), "unknown_tool");
      const id = safeToken(
        firstValue(call.tool_call_id, call.request_id, call.id),
        `${name}:${sequence + 1}`,
      );
      const record = {
        toolCallId: id,
        toolName: name,
        sequenceNumber: ++sequence,
        status: "pending",
        startedOffsetMs: epochMilliseconds(firstValue(call.time_in_call_secs, call.start_time))
          ?? null,
        durationMs: null,
        parameterKeys: parameterKeys(call),
        resultSummary: "Call was triggered and is awaiting a recorded result.",
        errorCode: null,
        errorMessage: null,
      };
      calls.push(record);
      callsById.set(id, record);
    }

    for (const result of asArray(turn?.tool_results)) {
      const name = safeToken(firstValue(result.tool_name, result.name), "unknown_tool");
      const id = safeToken(firstValue(result.tool_call_id, result.request_id, result.id));
      let record = id ? callsById.get(id) : null;
      if (!record) {
        record = [...calls].reverse().find((candidate) => (
          candidate.status === "pending" && candidate.toolName === name
        ));
      }
      if (!record) {
        const generatedId = id || `${name}:${sequence + 1}`;
        record = {
          toolCallId: generatedId,
          toolName: name,
          sequenceNumber: ++sequence,
          status: "pending",
          startedOffsetMs: null,
          durationMs: null,
          parameterKeys: [],
          resultSummary: null,
          errorCode: null,
          errorMessage: null,
        };
        calls.push(record);
        callsById.set(generatedId, record);
      }

      const failure = result.is_error === true
        ? {
          code: safeToken(firstValue(result.error_code, result.code), "tool_error"),
          message: redactText(firstValue(result.error_message, result.error, result.result), 240)
            || "The tool returned an error.",
        }
        : toolFailure(firstValue(result.result, result.output, result));
      record.status = failure ? "error" : "success";
      record.resultSummary = failure ? "Tool call failed." : "Tool call completed successfully.";
      record.errorCode = failure?.code || null;
      record.errorMessage = failure?.message || null;
      const duration = Number(firstValue(result.duration_ms, result.latency_ms));
      record.durationMs = Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : null;
    }
  }

  return calls;
}

function otelAttributes(attributes) {
  const values = {};
  for (const attribute of asArray(attributes)) {
    const key = String(attribute?.key || "");
    const value = asObject(attribute?.value);
    values[key] = firstValue(
      value.stringValue,
      value.string_value,
      value.intValue,
      value.int_value,
      value.boolValue,
      value.bool_value,
    );
  }
  return values;
}

function collectOtelSpans(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectOtelSpans(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value.spans)) output.push(...value.spans);
  for (const key of ["resourceSpans", "resource_spans", "scopeSpans", "scope_spans"] ) {
    if (value[key]) collectOtelSpans(value[key], output);
  }
  return output;
}

function nanosecondDuration(start, end) {
  try {
    if (!start || !end) return null;
    const difference = BigInt(end) - BigInt(start);
    return Number(difference / 1000000n);
  } catch {
    return null;
  }
}

function parseOtelTools(payload, startingSequence) {
  const tools = [];
  let sequence = startingSequence;
  for (const span of collectOtelSpans(payload)) {
    const spanName = String(firstValue(span.name, span.span_name) || "");
    if (!spanName.startsWith("elevenlabs.tool.")) continue;
    const attributes = otelAttributes(span.attributes);
    const toolName = safeToken(
      firstValue(attributes["elevenlabs.tool.name"], spanName.slice("elevenlabs.tool.".length)),
      "unknown_tool",
    );
    const statusCode = firstValue(span.status?.code, span.status?.status_code);
    const failed = statusCode === 2
      || String(statusCode || "").toUpperCase().includes("ERROR");
    tools.push({
      toolCallId: safeToken(
        firstValue(attributes["elevenlabs.tool_call_id"], attributes.tool_call_id, span.spanId, span.span_id),
        `${toolName}:otel:${sequence + 1}`,
      ),
      toolName,
      sequenceNumber: ++sequence,
      status: failed ? "error" : "success",
      startedOffsetMs: null,
      durationMs: nanosecondDuration(
        firstValue(span.startTimeUnixNano, span.start_time_unix_nano),
        firstValue(span.endTimeUnixNano, span.end_time_unix_nano),
      ),
      parameterKeys: [],
      resultSummary: failed ? "Tool trace reported an error." : "Tool trace completed successfully.",
      errorCode: failed ? "tool_trace_error" : null,
      errorMessage: failed
        ? redactText(firstValue(span.status?.message, span.status?.description), 240)
          || "The tool trace reported an error."
        : null,
    });
  }
  return tools;
}

function mergeTools(primary, additional) {
  const merged = new Map();
  for (const tool of [...primary, ...additional]) {
    const existing = merged.get(tool.toolCallId);
    if (!existing || existing.status === "pending") merged.set(tool.toolCallId, tool);
  }
  return [...merged.values()].sort((left, right) => left.sequenceNumber - right.sequenceNumber);
}

function buildExpectedTools(intent, progress, tools, hasDetails) {
  if (!hasDetails) return null;
  const observed = new Map(tools.map((tool) => [tool.toolName, tool.status]));
  const names = [...new Set([...KNOWN_TOOLS, ...observed.keys()])];
  const required = new Set();

  if (intent === "booking") {
    required.add(BOOKING_TOOLS[0]);
    const observedRank = BOOKING_TOOLS.reduce(
      (highest, name, index) => observed.has(name) ? Math.max(highest, index) : highest,
      -1,
    );
    const highestRank = Math.max(observedRank, progressRank(progress));
    for (let index = 0; index <= highestRank; index += 1) required.add(BOOKING_TOOLS[index]);
  }
  if (intent === "cancellation") required.add("show_booking_for_cancellation");
  if (intent === "offers") required.add("show_offers");
  if (intent === "handover") required.add("handover_to_agent");
  if (intent === "booking_summary") required.add("show_booking_summary");

  return names.map((toolName) => {
    const expectation = required.has(toolName) ? "expected" : "conditional";
    const observedStatus = observed.get(toolName) || "not_triggered";
    let reason = "Not required by the detected journey.";
    if (expectation === "expected" && observedStatus === "not_triggered") {
      reason = "Expected for this journey, but no call was recorded.";
    } else if (expectation === "expected") {
      reason = "Expected for this journey and a call was recorded.";
    } else if (observedStatus !== "not_triggered") {
      reason = "Triggered during the conversation even though it was conditional.";
    }
    return { toolName, expectation, observedStatus, reason };
  });
}

function extractError(value) {
  if (!value) return { code: null, message: null };
  const object = asObject(value);
  return {
    code: safeToken(firstValue(object.error_code, object.code, object.type), "conversation_error"),
    message: redactText(firstValue(object.error_message, object.message, object.detail, value), 240),
  };
}

function extractConversation(payload, source, eventType = "") {
  const data = asObject(payload?.data && typeof payload.data === "object" ? payload.data : payload);
  const metadata = asObject(data.metadata);
  const analysis = asObject(data.analysis);
  const initiation = asObject(firstValue(
    data.conversation_initiation_client_data,
    data.conversation_initiation_data,
  ));
  const dynamicVariables = asObject(firstValue(
    initiation.dynamic_variables,
    initiation.dynamic_variables_values,
    data.dynamic_variables,
  ));
  const transcript = asArray(data.transcript);
  const userText = transcript
    .filter((turn) => String(turn?.role || "").toLowerCase() === "user")
    .map((turn) => String(firstValue(turn.message, turn.text, "")))
    .join(" ");
  const transcriptTools = parseTranscriptTools(transcript);
  const tools = mergeTools(
    transcriptTools,
    parseOtelTools(data, transcriptTools.length),
  ).slice(0, 200);
  const now = Date.now();
  const hasDetails = source !== "list_api";
  const startedAt = epochMilliseconds(firstValue(
    data.start_time_unix_secs,
    metadata.start_time_unix_secs,
    data.started_at,
  ));
  const durationSeconds = Number(firstValue(
    data.call_duration_secs,
    metadata.call_duration_secs,
    data.duration_seconds,
  ));
  const safeDuration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : null;
  const endedAt = epochMilliseconds(firstValue(data.end_time_unix_secs, metadata.end_time_unix_secs))
    || (startedAt && safeDuration !== null ? startedAt + Math.round(safeDuration * 1000) : null);
  const intent = classifyIntent(userText, dynamicVariables);
  const progress = safeToken(firstValue(
    dynamicVariables.voxi_booking_progress,
    dynamicVariables.booking_progress,
  ), "unknown");
  const payloadError = extractError(firstValue(
    data.error,
    data.failure_reason,
    analysis.error,
    eventType === "call_initiation_failure" ? data : null,
  ));
  const latestToolError = [...tools].reverse().find((tool) => tool.status === "error");
  const status = normalizeStatus(firstValue(data.status, metadata.status), eventType);
  const callSuccessful = eventType === "call_initiation_failure"
    ? 0
    : normalizeSuccessful(firstValue(data.call_successful, analysis.call_successful));
  const expectedTools = buildExpectedTools(intent, progress, tools, hasDetails);

  return {
    conversationId: safeToken(firstValue(data.conversation_id, payload?.conversation_id)),
    agentId: safeToken(firstValue(data.agent_id, payload?.agent_id), "unknown_agent"),
    agentName: redactText(firstValue(data.agent_name, payload?.agent_name), 120),
    status,
    startedAt,
    endedAt,
    durationSeconds: safeDuration,
    messageCount: Number.isFinite(Number(data.message_count))
      ? Math.max(0, Math.round(Number(data.message_count)))
      : transcript.length,
    callSuccessful,
    language: normalizeLanguage(firstValue(
      data.main_language,
      analysis.main_language,
      dynamicVariables.preferred_language,
      dynamicVariables.language,
    ), userText),
    channel: firstValue(data.has_audio, metadata.has_audio) === true ? "voice" : "text",
    intent,
    bookingProgress: progress,
    terminationReason: redactText(firstValue(
      metadata.termination_reason,
      data.termination_reason,
    ), 160),
    environment: safeToken(firstValue(dynamicVariables.environment, data.environment), "production"),
    branchId: safeToken(firstValue(data.branch_id, metadata.branch_id, data.agent_branch_id)),
    versionId: safeToken(firstValue(data.version_id, metadata.version_id, data.agent_version_id)),
    tools,
    expectedTools,
    latestErrorCode: latestToolError?.errorCode || payloadError.code,
    latestErrorMessage: latestToolError?.errorMessage || payloadError.message,
    source,
    firstSeenAt: now,
    updatedAt: now,
    lastSyncedAt: now,
    detailsSyncedAt: hasDetails ? now : null,
    hasDetails,
  };
}

function conversationStatement(db, record) {
  const counts = record.hasDetails ? {
    total: record.tools.length,
    success: record.tools.filter((tool) => tool.status === "success").length,
    error: record.tools.filter((tool) => tool.status === "error").length,
    pending: record.tools.filter((tool) => tool.status === "pending").length,
    missing: record.expectedTools?.filter((tool) => (
      tool.expectation === "expected" && tool.observedStatus === "not_triggered"
    )).length || 0,
  } : { total: null, success: null, error: null, pending: null, missing: null };

  return db.prepare(`
    INSERT INTO conversations (
      conversation_id, agent_id, agent_name, status, started_at, ended_at,
      duration_seconds, message_count, call_successful, language, channel, intent,
      booking_progress, termination_reason, environment, branch_id, version_id,
      tool_total, tool_success_count, tool_error_count, tool_pending_count,
      expected_missing_count, latest_error_code, latest_error_message, source,
      first_seen_at, updated_at, last_synced_at, details_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(conversation_id) DO UPDATE SET
      agent_id = COALESCE(NULLIF(excluded.agent_id, 'unknown_agent'), conversations.agent_id),
      agent_name = COALESCE(excluded.agent_name, conversations.agent_name),
      status = COALESCE(NULLIF(excluded.status, 'unknown'), conversations.status),
      started_at = COALESCE(excluded.started_at, conversations.started_at),
      ended_at = COALESCE(excluded.ended_at, conversations.ended_at),
      duration_seconds = COALESCE(excluded.duration_seconds, conversations.duration_seconds),
      message_count = MAX(COALESCE(excluded.message_count, 0), COALESCE(conversations.message_count, 0)),
      call_successful = COALESCE(excluded.call_successful, conversations.call_successful),
      language = COALESCE(excluded.language, conversations.language),
      channel = COALESCE(excluded.channel, conversations.channel),
      intent = CASE WHEN excluded.intent != 'unknown' THEN excluded.intent ELSE conversations.intent END,
      booking_progress = CASE WHEN excluded.booking_progress != 'unknown' THEN excluded.booking_progress ELSE conversations.booking_progress END,
      termination_reason = COALESCE(excluded.termination_reason, conversations.termination_reason),
      environment = COALESCE(excluded.environment, conversations.environment),
      branch_id = COALESCE(excluded.branch_id, conversations.branch_id),
      version_id = COALESCE(excluded.version_id, conversations.version_id),
      tool_total = COALESCE(excluded.tool_total, conversations.tool_total),
      tool_success_count = COALESCE(excluded.tool_success_count, conversations.tool_success_count),
      tool_error_count = COALESCE(excluded.tool_error_count, conversations.tool_error_count),
      tool_pending_count = COALESCE(excluded.tool_pending_count, conversations.tool_pending_count),
      expected_missing_count = COALESCE(excluded.expected_missing_count, conversations.expected_missing_count),
      latest_error_code = COALESCE(excluded.latest_error_code, conversations.latest_error_code),
      latest_error_message = COALESCE(excluded.latest_error_message, conversations.latest_error_message),
      source = excluded.source,
      updated_at = excluded.updated_at,
      last_synced_at = excluded.last_synced_at,
      details_synced_at = COALESCE(excluded.details_synced_at, conversations.details_synced_at)
  `).bind(
    record.conversationId,
    record.agentId,
    record.agentName,
    record.status,
    record.startedAt,
    record.endedAt,
    record.durationSeconds,
    record.messageCount,
    record.callSuccessful,
    record.language,
    record.channel,
    record.intent,
    record.bookingProgress,
    record.terminationReason,
    record.environment,
    record.branchId,
    record.versionId,
    counts.total,
    counts.success,
    counts.error,
    counts.pending,
    counts.missing,
    record.latestErrorCode,
    record.latestErrorMessage,
    record.source,
    record.firstSeenAt,
    record.updatedAt,
    record.lastSyncedAt,
    record.detailsSyncedAt,
  );
}

function toolStatement(db, conversationId, tool, source, now) {
  return db.prepare(`
    INSERT INTO tool_activity (
      conversation_id, tool_call_id, tool_name, sequence_number, status,
      started_offset_ms, duration_ms, parameter_keys, result_summary,
      error_code, error_message, source, first_seen_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(conversation_id, tool_call_id) DO UPDATE SET
      tool_name = excluded.tool_name,
      sequence_number = excluded.sequence_number,
      status = CASE
        WHEN tool_activity.status = 'success' AND excluded.status = 'pending' THEN tool_activity.status
        WHEN tool_activity.status = 'error' AND excluded.status = 'pending' THEN tool_activity.status
        ELSE excluded.status
      END,
      started_offset_ms = COALESCE(excluded.started_offset_ms, tool_activity.started_offset_ms),
      duration_ms = COALESCE(excluded.duration_ms, tool_activity.duration_ms),
      parameter_keys = CASE WHEN excluded.parameter_keys != '[]' THEN excluded.parameter_keys ELSE tool_activity.parameter_keys END,
      result_summary = COALESCE(excluded.result_summary, tool_activity.result_summary),
      error_code = COALESCE(excluded.error_code, tool_activity.error_code),
      error_message = COALESCE(excluded.error_message, tool_activity.error_message),
      source = excluded.source,
      updated_at = excluded.updated_at
  `).bind(
    conversationId,
    tool.toolCallId,
    tool.toolName,
    tool.sequenceNumber,
    tool.status,
    tool.startedOffsetMs,
    tool.durationMs,
    JSON.stringify(tool.parameterKeys),
    tool.resultSummary,
    tool.errorCode,
    tool.errorMessage,
    source,
    now,
    now,
  );
}

function logStatement(db, log) {
  return db.prepare(`
    INSERT OR IGNORE INTO interaction_logs (
      event_key, conversation_id, created_at, level, event_type, source, message, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    log.eventKey,
    log.conversationId,
    log.createdAt,
    log.level,
    log.eventType,
    log.source,
    log.message,
    log.detailsJson || null,
  );
}

async function ingestConversation(env, payload, source, eventType = "") {
  const db = await ensureSchema(env);
  const record = extractConversation(payload, source, eventType);
  if (!record.conversationId) {
    throw new MonitoringError(
      "The ElevenLabs event did not include a valid conversation identifier.",
      422,
      "conversation_id_missing",
    );
  }

  await conversationStatement(db, record).run();
  const statements = [];
  for (const tool of record.tools) {
    statements.push(toolStatement(db, record.conversationId, tool, source, record.updatedAt));
    statements.push(logStatement(db, {
      eventKey: `${record.conversationId}:tool:${tool.toolCallId}:${tool.status}`,
      conversationId: record.conversationId,
      createdAt: record.updatedAt,
      level: tool.status === "error" ? "error" : tool.status === "pending" ? "warn" : "info",
      eventType: `tool.${tool.status}`,
      source,
      message: `${tool.toolName} ${tool.status === "success" ? "completed" : tool.status}.`,
      detailsJson: JSON.stringify({ tool_name: tool.toolName, error_code: tool.errorCode }),
    }));
  }

  if (record.expectedTools) {
    statements.push(db.prepare("DELETE FROM expected_tools WHERE conversation_id = ?")
      .bind(record.conversationId));
    for (const expected of record.expectedTools) {
      statements.push(db.prepare(`
        INSERT INTO expected_tools (
          conversation_id, tool_name, expectation, observed_status, reason, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        record.conversationId,
        expected.toolName,
        expected.expectation,
        expected.observedStatus,
        expected.reason,
        record.updatedAt,
      ));
      if (expected.expectation === "expected" && expected.observedStatus === "not_triggered") {
        statements.push(logStatement(db, {
          eventKey: `${record.conversationId}:missing:${expected.toolName}`,
          conversationId: record.conversationId,
          createdAt: record.updatedAt,
          level: "warn",
          eventType: "tool.not_triggered",
          source,
          message: `${expected.toolName} was expected but not triggered.`,
          detailsJson: JSON.stringify({ tool_name: expected.toolName }),
        }));
      }
    }
  }

  statements.push(logStatement(db, {
    eventKey: `${record.conversationId}:discovered`,
    conversationId: record.conversationId,
    createdAt: record.startedAt || record.updatedAt,
    level: "info",
    eventType: "conversation.discovered",
    source,
    message: "Conversation activity was recorded.",
    detailsJson: JSON.stringify({ status: record.status, channel: record.channel }),
  }));
  statements.push(logStatement(db, {
    eventKey: `${record.conversationId}:status:${record.status}`,
    conversationId: record.conversationId,
    createdAt: record.updatedAt,
    level: record.status === "failed" ? "error" : "info",
    eventType: "conversation.status",
    source,
    message: `Conversation status changed to ${record.status}.`,
    detailsJson: JSON.stringify({ status: record.status }),
  }));

  if (record.latestErrorCode || record.latestErrorMessage) {
    statements.push(logStatement(db, {
      eventKey: `${record.conversationId}:error:${record.latestErrorCode || "conversation_error"}`,
      conversationId: record.conversationId,
      createdAt: record.updatedAt,
      level: "error",
      eventType: "conversation.error",
      source,
      message: record.latestErrorMessage || "A conversation error was reported.",
      detailsJson: JSON.stringify({ error_code: record.latestErrorCode }),
    }));
  }

  if (statements.length) await db.batch(statements);

  if (record.tools.length || record.expectedTools) {
    await db.batch([
      db.prepare(`
        UPDATE expected_tools
        SET observed_status = COALESCE((
          SELECT status FROM tool_activity
          WHERE tool_activity.conversation_id = expected_tools.conversation_id
            AND tool_activity.tool_name = expected_tools.tool_name
          ORDER BY sequence_number DESC LIMIT 1
        ), 'not_triggered'), updated_at = ?
        WHERE conversation_id = ?
      `).bind(record.updatedAt, record.conversationId),
      db.prepare(`
        UPDATE conversations SET
          tool_total = (SELECT COUNT(*) FROM tool_activity WHERE conversation_id = ?),
          tool_success_count = (SELECT COUNT(*) FROM tool_activity WHERE conversation_id = ? AND status = 'success'),
          tool_error_count = (SELECT COUNT(*) FROM tool_activity WHERE conversation_id = ? AND status = 'error'),
          tool_pending_count = (SELECT COUNT(*) FROM tool_activity WHERE conversation_id = ? AND status = 'pending'),
          expected_missing_count = (SELECT COUNT(*) FROM expected_tools WHERE conversation_id = ? AND expectation = 'expected' AND observed_status = 'not_triggered')
        WHERE conversation_id = ?
      `).bind(
        record.conversationId,
        record.conversationId,
        record.conversationId,
        record.conversationId,
        record.conversationId,
        record.conversationId,
      ),
    ]);
  }

  return record;
}

function elevenLabsConfig(env) {
  const apiKey = String(env?.ELEVENLABS_API_KEY || "").trim();
  const agentId = String(env?.ELEVENLABS_AGENT_ID || "").trim();
  const apiBase = String(
    env?.ELEVENLABS_API_BASE || "https://api.eu.residency.elevenlabs.io",
  ).trim().replace(/\/$/, "");
  if (!apiKey || !agentId) {
    throw new MonitoringError(
      "ElevenLabs monitoring credentials are not configured.",
      503,
      "elevenlabs_not_configured",
    );
  }
  return { apiKey, agentId, apiBase };
}

async function elevenLabsJson(config, path, search = {}) {
  const url = new URL(`${config.apiBase}${path}`);
  for (const [key, value] of Object.entries(search)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, {
    headers: { Accept: "application/json", "xi-api-key": config.apiKey },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new MonitoringError(
      redactText(firstValue(payload?.detail?.message, payload?.detail, payload?.message), 180)
        || "ElevenLabs returned an unsuccessful response.",
      502,
      `elevenlabs_http_${response.status}`,
    );
  }
  return payload;
}

async function listConversationPage(config, cursor = null) {
  return elevenLabsJson(config, "/v1/convai/conversations", {
    agent_id: config.agentId,
    page_size: LIST_PAGE_SIZE,
    cursor,
  });
}

async function fetchConversationDetail(config, conversationId) {
  return elevenLabsJson(
    config,
    `/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
  );
}

async function mapWithConcurrency(items, concurrency, operation) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      try {
        results[current] = { ok: true, value: await operation(items[current]) };
      } catch (error) {
        results[current] = { ok: false, error };
      }
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  ));
  return results;
}

async function existingConversations(db, ids) {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const result = await db.prepare(`
    SELECT conversation_id, status, details_synced_at
    FROM conversations WHERE conversation_id IN (${placeholders})
  `).bind(...ids).all();
  return new Map((result.results || []).map((row) => [row.conversation_id, row]));
}

function isActiveStatus(status) {
  return ["initiated", "in_progress", "processing", "pending"].includes(
    String(status || "").toLowerCase(),
  );
}

async function ingestPage(env, config, page) {
  const db = await ensureSchema(env);
  const conversations = asArray(page?.conversations).filter((item) => (
    safeToken(item?.conversation_id)
  ));
  const ids = conversations.map((item) => item.conversation_id);
  const existing = await existingConversations(db, ids);
  const detailsToLoad = [];

  for (const item of conversations) {
    const known = existing.get(item.conversation_id);
    if (!known?.details_synced_at || isActiveStatus(item.status) || known.status !== item.status) {
      detailsToLoad.push(item.conversation_id);
    }
    await ingestConversation(env, item, "list_api");
  }

  const detailResults = await mapWithConcurrency(
    detailsToLoad,
    4,
    (conversationId) => fetchConversationDetail(config, conversationId),
  );
  let detailsLoaded = 0;
  let errors = 0;
  for (let index = 0; index < detailResults.length; index += 1) {
    const result = detailResults[index];
    const conversationId = detailsToLoad[index];
    if (result.ok) {
      await ingestConversation(env, result.value, "conversation_api");
      detailsLoaded += 1;
    } else {
      errors += 1;
      const error = result.error;
      await logStatement(db, {
        eventKey: `${conversationId}:detail-sync:${safeToken(error?.code, "error")}`,
        conversationId,
        createdAt: Date.now(),
        level: "error",
        eventType: "sync.detail_error",
        source: "conversation_api",
        message: redactText(error?.message, 180) || "Conversation detail could not be synchronized.",
        detailsJson: JSON.stringify({ error_code: safeToken(error?.code, "sync_error") }),
      }).run();
    }
  }

  return {
    conversationsSeen: conversations.length,
    detailsLoaded,
    errors,
    nextCursor: firstValue(page?.next_cursor, page?.nextCursor) || null,
    hasMore: Boolean(firstValue(page?.has_more, page?.hasMore)),
  };
}

async function readState(db, key) {
  const row = await db.prepare(
    "SELECT state_value FROM sync_state WHERE state_key = ?",
  ).bind(key).first();
  return row?.state_value ?? null;
}

async function writeState(db, key, value) {
  await db.prepare(`
    INSERT INTO sync_state (state_key, state_value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value, updated_at = excluded.updated_at
  `).bind(key, value, Date.now()).run();
}

export async function syncElevenLabs(env) {
  const db = await ensureSchema(env);
  const config = elevenLabsConfig(env);
  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  await db.prepare(`
    INSERT INTO sync_runs (run_id, started_at, status, source)
    VALUES (?, ?, 'running', 'dashboard')
  `).bind(runId, startedAt).run();

  const totals = { pages: 0, conversations: 0, details: 0, errors: 0 };
  try {
    const latestPage = await listConversationPage(config);
    const latestResult = await ingestPage(env, config, latestPage);
    totals.pages += 1;
    totals.conversations += latestResult.conversationsSeen;
    totals.details += latestResult.detailsLoaded;
    totals.errors += latestResult.errors;
    await writeState(db, "last_live_sync_at", String(Date.now()));

    let backfillCursor = await readState(db, "backfill_cursor");
    if (backfillCursor === null) {
      backfillCursor = latestResult.hasMore && latestResult.nextCursor
        ? latestResult.nextCursor
        : "__complete__";
      await writeState(db, "backfill_cursor", backfillCursor);
    } else if (backfillCursor !== "__complete__") {
      const historicalPage = await listConversationPage(config, backfillCursor);
      const historicalResult = await ingestPage(env, config, historicalPage);
      totals.pages += 1;
      totals.conversations += historicalResult.conversationsSeen;
      totals.details += historicalResult.detailsLoaded;
      totals.errors += historicalResult.errors;
      const next = historicalResult.hasMore && historicalResult.nextCursor
        ? historicalResult.nextCursor
        : "__complete__";
      await writeState(db, "backfill_cursor", next);
      if (next === "__complete__") {
        await writeState(db, "backfill_completed_at", String(Date.now()));
      }
      backfillCursor = next;
    }

    await db.prepare(`
      UPDATE sync_runs SET completed_at = ?, status = 'success', pages_processed = ?,
        conversations_seen = ?, details_loaded = ?, errors_count = ? WHERE run_id = ?
    `).bind(
      Date.now(),
      totals.pages,
      totals.conversations,
      totals.details,
      totals.errors,
      runId,
    ).run();

    return {
      runId,
      ...totals,
      backfillComplete: backfillCursor === "__complete__",
    };
  } catch (error) {
    await db.prepare(`
      UPDATE sync_runs SET completed_at = ?, status = 'error', pages_processed = ?,
        conversations_seen = ?, details_loaded = ?, errors_count = ?,
        error_code = ?, error_message = ? WHERE run_id = ?
    `).bind(
      Date.now(),
      totals.pages,
      totals.conversations,
      totals.details,
      totals.errors + 1,
      safeToken(error?.code, "sync_error"),
      redactText(error?.message, 180),
      runId,
    ).run();
    throw error;
  }
}

export async function monitoringHealth(env) {
  const status = {
    database: Boolean(env?.VOXI_MONITORING_DB),
    access: Boolean(env?.CF_ACCESS_TEAM_DOMAIN && env?.CF_ACCESS_AUD),
    elevenlabsApi: Boolean(env?.ELEVENLABS_API_KEY && env?.ELEVENLABS_AGENT_ID),
    webhook: Boolean(env?.ELEVENLABS_WEBHOOK_SECRET),
    agentId: safeToken(env?.ELEVENLABS_AGENT_ID),
    apiRegion: String(env?.ELEVENLABS_API_BASE || "").includes("eu.residency") ? "EU" : "configured",
    lastLiveSyncAt: null,
    backfillComplete: false,
  };
  if (status.database) {
    const db = await ensureSchema(env);
    status.lastLiveSyncAt = Number(await readState(db, "last_live_sync_at")) || null;
    status.backfillComplete = await readState(db, "backfill_cursor") === "__complete__";
  }
  return status;
}

function rows(result) {
  return result?.results || [];
}

export async function monitoringSummary(env) {
  const db = await ensureSchema(env);
  const now = Date.now();
  const [totals, tools, missing, recentErrors, syncRuns] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN lower(status) IN ('initiated','in_progress','processing','pending') THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS last_24_hours,
        SUM(CASE WHEN tool_error_count > 0 OR call_successful = 0 THEN 1 ELSE 0 END) AS with_errors,
        SUM(CASE WHEN expected_missing_count > 0 THEN 1 ELSE 0 END) AS with_missing_calls,
        SUM(tool_success_count) AS successful_tools,
        SUM(tool_error_count) AS failed_tools,
        SUM(tool_pending_count) AS pending_tools,
        MAX(updated_at) AS latest_activity_at
      FROM conversations
    `).bind(now - 24 * 60 * 60 * 1000).first(),
    db.prepare(`
      SELECT tool_name,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count
      FROM tool_activity GROUP BY tool_name ORDER BY tool_name
    `).all(),
    db.prepare(`
      SELECT tool_name, COUNT(*) AS missing_count
      FROM expected_tools
      WHERE expectation = 'expected' AND observed_status = 'not_triggered'
      GROUP BY tool_name ORDER BY tool_name
    `).all(),
    db.prepare(`
      SELECT conversation_id, started_at, latest_error_code, latest_error_message
      FROM conversations
      WHERE tool_error_count > 0 OR call_successful = 0 OR latest_error_message IS NOT NULL
      ORDER BY COALESCE(started_at, updated_at) DESC LIMIT 6
    `).all(),
    db.prepare(`
      SELECT run_id, started_at, completed_at, status, pages_processed,
        conversations_seen, details_loaded, errors_count, error_code, error_message
      FROM sync_runs ORDER BY started_at DESC LIMIT 5
    `).all(),
  ]);

  const byTool = new Map(KNOWN_TOOLS.map((name) => [name, {
    tool_name: name,
    success_count: 0,
    error_count: 0,
    pending_count: 0,
    missing_count: 0,
  }]));
  for (const item of rows(tools)) {
    byTool.set(item.tool_name, { ...byTool.get(item.tool_name), ...item, missing_count: 0 });
  }
  for (const item of rows(missing)) {
    const current = byTool.get(item.tool_name) || {
      tool_name: item.tool_name,
      success_count: 0,
      error_count: 0,
      pending_count: 0,
      missing_count: 0,
    };
    current.missing_count = item.missing_count;
    byTool.set(item.tool_name, current);
  }

  return {
    totals: totals || {},
    tools: [...byTool.values()],
    recentErrors: rows(recentErrors),
    syncRuns: rows(syncRuns),
  };
}

function positiveInteger(value, fallback, maximum) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(number, maximum);
}

export async function listMonitoredConversations(env, searchParams) {
  const db = await ensureSchema(env);
  const conditions = [];
  const parameters = [];
  const status = safeToken(searchParams.get("status"));
  const language = safeToken(searchParams.get("language"));
  const intent = safeToken(searchParams.get("intent"));
  const query = String(searchParams.get("q") || "").trim().slice(0, 100);
  const issueOnly = searchParams.get("issues") === "1";
  const limit = positiveInteger(searchParams.get("limit"), 50, 100);
  const offset = positiveInteger(searchParams.get("offset"), 0, 100000);

  if (status) {
    conditions.push("status = ?");
    parameters.push(status);
  }
  if (language) {
    conditions.push("language = ?");
    parameters.push(language);
  }
  if (intent) {
    conditions.push("intent = ?");
    parameters.push(intent);
  }
  if (query) {
    conditions.push("conversation_id LIKE ?");
    parameters.push(`%${query.replace(/[%_]/g, "")}%`);
  }
  if (issueOnly) {
    conditions.push("(tool_error_count > 0 OR expected_missing_count > 0 OR call_successful = 0)");
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [result, count] = await Promise.all([
    db.prepare(`
      SELECT conversation_id, agent_id, status, started_at, ended_at, duration_seconds,
        message_count, call_successful, language, channel, intent, booking_progress,
        tool_total, tool_success_count, tool_error_count, tool_pending_count,
        expected_missing_count, latest_error_code, latest_error_message, source,
        updated_at, details_synced_at
      FROM conversations ${where}
      ORDER BY COALESCE(started_at, updated_at) DESC LIMIT ? OFFSET ?
    `).bind(...parameters, limit, offset).all(),
    db.prepare(`SELECT COUNT(*) AS total FROM conversations ${where}`)
      .bind(...parameters).first(),
  ]);
  return { conversations: rows(result), total: count?.total || 0, limit, offset };
}

export async function monitoredConversationDetail(env, conversationId) {
  const id = safeToken(conversationId);
  if (!id) throw new MonitoringError("Conversation was not found.", 404, "not_found");
  const db = await ensureSchema(env);
  const conversation = await db.prepare(`
    SELECT conversation_id, agent_id, agent_name, status, started_at, ended_at,
      duration_seconds, message_count, call_successful, language, channel, intent,
      booking_progress, termination_reason, environment, branch_id, version_id,
      tool_total, tool_success_count, tool_error_count, tool_pending_count,
      expected_missing_count, latest_error_code, latest_error_message, source,
      first_seen_at, updated_at, last_synced_at, details_synced_at
    FROM conversations WHERE conversation_id = ?
  `).bind(id).first();
  if (!conversation) throw new MonitoringError("Conversation was not found.", 404, "not_found");

  const [toolResult, expectedResult, logResult] = await Promise.all([
    db.prepare(`
      SELECT tool_call_id, tool_name, sequence_number, status, started_offset_ms,
        duration_ms, parameter_keys, result_summary, error_code, error_message,
        source, first_seen_at, updated_at
      FROM tool_activity WHERE conversation_id = ? ORDER BY sequence_number, id
    `).bind(id).all(),
    db.prepare(`
      SELECT tool_name, expectation, observed_status, reason, updated_at
      FROM expected_tools WHERE conversation_id = ? ORDER BY tool_name
    `).bind(id).all(),
    db.prepare(`
      SELECT created_at, level, event_type, source, message, details_json
      FROM interaction_logs WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 200
    `).bind(id).all(),
  ]);

  let expectedTools = rows(expectedResult);
  if (!expectedTools.length) {
    expectedTools = KNOWN_TOOLS.map((toolName) => ({
      tool_name: toolName,
      expectation: "conditional",
      observed_status: "not_triggered",
      reason: "Conversation detail has not been synchronized yet.",
      updated_at: conversation.updated_at,
    }));
  }
  return {
    conversation,
    tools: rows(toolResult).map((tool) => ({
      ...tool,
      parameter_keys: (() => {
        try { return JSON.parse(tool.parameter_keys || "[]"); } catch { return []; }
      })(),
    })),
    expectedTools,
    logs: rows(logResult).map((log) => ({
      ...log,
      details: (() => {
        try { return JSON.parse(log.details_json || "{}"); } catch { return {}; }
      })(),
      details_json: undefined,
    })),
  };
}

function hexBytes(value) {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) return new Uint8Array();
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function verifyElevenLabsSignature(request, rawBody, secret) {
  if (!secret) {
    throw new MonitoringError(
      "The webhook signing secret is not configured.",
      503,
      "webhook_not_configured",
    );
  }
  if (rawBody.byteLength > MAX_WEBHOOK_BYTES) {
    throw new MonitoringError("Webhook payload is too large.", 413, "payload_too_large");
  }
  const signatureHeader = request.headers.get("ElevenLabs-Signature") || "";
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v0=")).map((part) => part.slice(3));
  const timestampNumber = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestampNumber) || Math.abs(now - timestampNumber) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new MonitoringError("Webhook signature timestamp is invalid.", 401, "invalid_signature");
  }
  if (!signatures.length) {
    throw new MonitoringError("Webhook signature is missing.", 401, "invalid_signature");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedPayload = new Uint8Array(
    encoder.encode(`${timestamp}.`).length + rawBody.byteLength,
  );
  signedPayload.set(encoder.encode(`${timestamp}.`), 0);
  signedPayload.set(new Uint8Array(rawBody), encoder.encode(`${timestamp}.`).length);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, signedPayload));
  if (!signatures.some((signature) => constantTimeEqual(expected, hexBytes(signature)))) {
    throw new MonitoringError("Webhook signature is invalid.", 401, "invalid_signature");
  }
}

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", value));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function ingestElevenLabsWebhook(env, payload, rawBody) {
  const db = await ensureSchema(env);
  const eventType = safeToken(payload?.type, "unknown_event");
  const supported = new Set([
    "post_call_transcription",
    "post_call_transcription_otel",
    "call_initiation_failure",
  ]);
  if (!supported.has(eventType)) {
    return { accepted: true, ignored: true, eventType };
  }

  const eventId = await sha256Hex(rawBody);
  const conversationId = safeToken(firstValue(
    payload?.data?.conversation_id,
    payload?.conversation_id,
  ));
  const receipt = await db.prepare(`
    INSERT OR IGNORE INTO webhook_receipts (
      event_id, event_type, conversation_id, received_at, processing_status
    ) VALUES (?, ?, ?, ?, 'received')
  `).bind(eventId, eventType, conversationId || null, Date.now()).run();
  if ((receipt?.meta?.changes || 0) === 0) {
    return { accepted: true, duplicate: true, eventType, conversationId };
  }

  const source = eventType === "post_call_transcription_otel"
    ? "otel_webhook"
    : eventType === "call_initiation_failure"
      ? "initiation_failure_webhook"
      : "transcription_webhook";
  try {
    const record = await ingestConversation(env, payload, source, eventType);
    await db.prepare(`
      UPDATE webhook_receipts SET processed_at = ?, processing_status = 'processed',
        conversation_id = ? WHERE event_id = ?
    `).bind(Date.now(), record.conversationId, eventId).run();
    return {
      accepted: true,
      duplicate: false,
      eventType,
      conversationId: record.conversationId,
    };
  } catch (error) {
    await db.prepare(`
      UPDATE webhook_receipts SET processed_at = ?, processing_status = 'error',
        error_code = ?, error_message = ? WHERE event_id = ?
    `).bind(
      Date.now(),
      safeToken(error?.code, "processing_error"),
      redactText(error?.message, 180),
      eventId,
    ).run();
    throw error;
  }
}
