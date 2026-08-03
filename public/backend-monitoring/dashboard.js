const state = {
  conversations: [],
  selectedId: null,
  refreshTimer: null,
  filteringTimer: null,
  syncing: false,
};

const elements = Object.fromEntries([
  "liveState", "freshness", "syncButton", "regionValue", "historyValue", "globalNotice",
  "metricTotal", "metricDay", "metricActive", "metricErrors", "metricToolErrors",
  "metricMissing", "metricRate", "metricCalls", "toolHealth", "resultCount",
  "filterForm", "searchInput", "statusFilter", "languageFilter", "intentFilter",
  "issueFilter", "conversationRows", "detailPanel", "recentErrors", "syncRuns",
].map((id) => [id, document.getElementById(id)]));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error?.message || `Request failed (${response.status})`);
    error.code = payload?.error?.code || `http_${response.status}`;
    throw error;
  }
  return payload;
}

function number(value) {
  return Number(value || 0).toLocaleString("en-AE");
}

function formatDate(value, includeDate = true) {
  if (!Number(value)) return "Not recorded";
  const options = includeDate
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { hour: "2-digit", minute: "2-digit", second: "2-digit" };
  return new Intl.DateTimeFormat("en-AE", options).format(new Date(Number(value)));
}

function relativeTime(value) {
  const timestamp = Number(value);
  if (!timestamp) return "Waiting for activity";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.floor(minutes / 60)}h ago`;
}

function duration(value) {
  const seconds = Math.round(Number(value || 0));
  if (!seconds) return "0s";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function title(value) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function badge(status, label = title(status)) {
  const value = String(status || "unknown").toLowerCase();
  const kind = value === "success" || value === "done" || value === "completed"
    ? "success"
    : value === "error" || value === "failed"
      ? "error"
      : value === "pending" || value === "in_progress" || value === "not_triggered"
        ? "warn"
        : "neutral";
  return `<span class="badge badge-${kind}">${escapeHtml(label)}</span>`;
}

function showNotice(message) {
  elements.globalNotice.textContent = message;
  elements.globalNotice.hidden = !message;
}

function setConnection(status, label) {
  elements.liveState.className = `live-state ${status}`;
  elements.liveState.innerHTML = `<i></i>${escapeHtml(label)}`;
}

function renderSummary(summary) {
  const totals = summary.totals || {};
  const successful = Number(totals.successful_tools || 0);
  const failed = Number(totals.failed_tools || 0);
  const pending = Number(totals.pending_tools || 0);
  const completedCalls = successful + failed;
  const successRate = completedCalls ? Math.round((successful / completedCalls) * 100) : 0;

  elements.metricTotal.textContent = number(totals.total);
  elements.metricDay.textContent = `${number(totals.last_24_hours)} in 24 hours`;
  elements.metricActive.textContent = number(totals.active);
  elements.metricErrors.textContent = number(totals.with_errors);
  elements.metricToolErrors.textContent = `${number(failed)} failed calls`;
  elements.metricMissing.textContent = number(totals.with_missing_calls);
  elements.metricRate.textContent = `${successRate}%`;
  elements.metricCalls.textContent = `${number(successful + failed + pending)} calls recorded`;
  elements.freshness.textContent = relativeTime(totals.latest_activity_at);

  elements.toolHealth.innerHTML = (summary.tools || []).map((tool) => `
    <article class="tool-health-card">
      <strong>${escapeHtml(tool.tool_name)}</strong>
      <div class="tool-health-counts">
        <span title="Successful"><i class="success-dot"></i>${number(tool.success_count)}</span>
        <span title="Errors"><i class="error-dot"></i>${number(tool.error_count)}</span>
        <span title="Expected but not triggered"><i class="missing-dot"></i>${number(tool.missing_count)}</span>
      </div>
    </article>
  `).join("");

  elements.recentErrors.innerHTML = summary.recentErrors?.length
    ? summary.recentErrors.map((error) => `
      <div class="error-list-item" data-conversation-id="${escapeHtml(error.conversation_id)}">
        <div><strong>${escapeHtml(error.latest_error_code || "conversation_error")}</strong><p>${escapeHtml(error.latest_error_message || "An unsuccessful interaction was recorded.")}</p></div>
        <time>${escapeHtml(formatDate(error.started_at, false))}</time>
      </div>
    `).join("")
    : '<p class="empty-copy">No errors recorded.</p>';

  elements.syncRuns.innerHTML = summary.syncRuns?.length
    ? summary.syncRuns.map((run) => `
      <div class="sync-list-item">
        <div><strong>${badge(run.status)} ${number(run.conversations_seen)} sessions</strong><p>${number(run.details_loaded)} details loaded, ${number(run.errors_count)} errors</p></div>
        <time>${escapeHtml(formatDate(run.started_at, false))}</time>
      </div>
    `).join("")
    : '<p class="empty-copy">No synchronization runs recorded.</p>';
}

function journeyHealth(conversation) {
  if (Number(conversation.tool_error_count) > 0 || conversation.call_successful === 0) {
    return badge("error", "Error");
  }
  if (Number(conversation.expected_missing_count) > 0) return badge("not_triggered", "Missing call");
  if (Number(conversation.tool_pending_count) > 0) return badge("pending", "In progress");
  return badge("success", "Healthy");
}

function renderConversations(payload) {
  state.conversations = payload.conversations || [];
  elements.resultCount.textContent = `${number(payload.total)} results`;
  if (!state.conversations.length) {
    elements.conversationRows.innerHTML = '<tr><td colspan="5" class="empty-row">No sessions match these filters.</td></tr>';
    return;
  }
  elements.conversationRows.innerHTML = state.conversations.map((conversation) => `
    <tr data-conversation-id="${escapeHtml(conversation.conversation_id)}" class="${state.selectedId === conversation.conversation_id ? "selected" : ""}">
      <td class="time-cell"><strong>${escapeHtml(formatDate(conversation.started_at, false))}</strong><small>${escapeHtml(formatDate(conversation.started_at).split(",")[0])}</small></td>
      <td class="id-cell"><strong>${escapeHtml(conversation.conversation_id)}</strong><small>${escapeHtml(title(conversation.status))} | ${escapeHtml(duration(conversation.duration_seconds))}</small></td>
      <td>${escapeHtml(title(conversation.intent))}<br><small>${escapeHtml((conversation.language || "--").toUpperCase())} | ${escapeHtml(title(conversation.channel))}</small></td>
      <td><span class="call-count">${number(conversation.tool_success_count)}/${number(conversation.tool_total)}</span><br><small>${number(conversation.expected_missing_count)} missing</small></td>
      <td>${journeyHealth(conversation)}</td>
    </tr>
  `).join("");
}

function renderDetail(payload) {
  const conversation = payload.conversation;
  const expected = payload.expectedTools || [];
  const errors = [
    conversation.latest_error_message ? {
      code: conversation.latest_error_code || "conversation_error",
      message: conversation.latest_error_message,
    } : null,
    ...(payload.tools || []).filter((tool) => tool.status === "error").map((tool) => ({
      code: tool.error_code || "tool_error",
      message: `${tool.tool_name}: ${tool.error_message || "Tool call failed."}`,
    })),
  ].filter(Boolean);

  elements.detailPanel.innerHTML = `
    <header class="detail-header">
      <p class="eyebrow">SESSION INSPECTOR</p>
      <h2>${escapeHtml(conversation.conversation_id)}</h2>
      <p>${escapeHtml(formatDate(conversation.started_at))} | ${escapeHtml(duration(conversation.duration_seconds))} | ${escapeHtml(title(conversation.status))}</p>
    </header>
    <div class="detail-meta">
      <div><span>Journey</span><strong>${escapeHtml(title(conversation.intent))}</strong></div>
      <div><span>Language</span><strong>${escapeHtml((conversation.language || "--").toUpperCase())}</strong></div>
      <div><span>Channel</span><strong>${escapeHtml(title(conversation.channel))}</strong></div>
      <div><span>Messages</span><strong>${number(conversation.message_count)}</strong></div>
      <div><span>Progress</span><strong>${escapeHtml(title(conversation.booking_progress))}</strong></div>
      <div><span>Source</span><strong>${escapeHtml(title(conversation.source))}</strong></div>
    </div>
    <section class="detail-section">
      <h3>Triggered and expected API calls</h3>
      <div class="api-matrix">
        ${expected.map((item) => `
          <div class="api-row">
            <div><strong>${escapeHtml(item.tool_name)}</strong><small>${escapeHtml(item.reason)}</small></div>
            ${badge(item.observed_status, item.observed_status === "not_triggered" ? "Not triggered" : title(item.observed_status))}
          </div>
        `).join("")}
      </div>
    </section>
    <section class="detail-section">
      <h3>Error details</h3>
      ${errors.length ? errors.map((error) => `
        <div class="error-card"><strong>${escapeHtml(error.code)}</strong><span>${escapeHtml(error.message)}</span></div>
      `).join("") : '<p class="empty-copy">No errors recorded for this session.</p>'}
    </section>
    <section class="detail-section">
      <h3>Interaction logs</h3>
      <div class="timeline">
        ${(payload.logs || []).length ? payload.logs.map((log) => `
          <div class="timeline-item ${escapeHtml(log.level)}">
            <strong>${escapeHtml(title(log.event_type))}</strong>
            <p>${escapeHtml(log.message)}</p>
            <time>${escapeHtml(formatDate(log.created_at))} | ${escapeHtml(title(log.source))}</time>
          </div>
        `).join("") : '<p class="empty-copy">No operational logs recorded.</p>'}
      </div>
    </section>
  `;
}

function filterQuery() {
  const params = new URLSearchParams({ limit: "60" });
  if (elements.searchInput.value.trim()) params.set("q", elements.searchInput.value.trim());
  if (elements.statusFilter.value) params.set("status", elements.statusFilter.value);
  if (elements.languageFilter.value) params.set("language", elements.languageFilter.value);
  if (elements.intentFilter.value) params.set("intent", elements.intentFilter.value);
  if (elements.issueFilter.checked) params.set("issues", "1");
  return params.toString();
}

async function loadConversations() {
  const payload = await api(`/backend-monitoring/api/conversations?${filterQuery()}`);
  renderConversations(payload);
  if (!state.selectedId && state.conversations.length) await selectConversation(state.conversations[0].conversation_id);
}

async function selectConversation(conversationId) {
  state.selectedId = conversationId;
  document.querySelectorAll("[data-conversation-id]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.conversationId === conversationId);
  });
  elements.detailPanel.innerHTML = '<div class="detail-placeholder"><span class="radar-icon"></span><h2>Loading session</h2></div>';
  try {
    renderDetail(await api(`/backend-monitoring/api/conversations/${encodeURIComponent(conversationId)}`));
  } catch (error) {
    elements.detailPanel.innerHTML = `<div class="detail-placeholder"><h2>Session unavailable</h2><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function refreshDashboard(options = {}) {
  try {
    const [healthPayload, summaryPayload] = await Promise.all([
      api("/backend-monitoring/api/health"),
      api("/backend-monitoring/api/summary"),
    ]);
    const health = healthPayload.health;
    elements.regionValue.textContent = health.apiRegion || "EU";
    elements.historyValue.textContent = health.backfillComplete ? "Complete" : "Backfilling";
    setConnection("connected", "Live");
    renderSummary(summaryPayload.summary);
    await loadConversations();
    if (state.selectedId && options.refreshDetail) await selectConversation(state.selectedId);
    showNotice(health.elevenlabsApi && health.webhook ? "" : "Monitoring ingestion is waiting for its server-side credentials.");
  } catch (error) {
    setConnection("error", "Unavailable");
    showNotice(error.message);
  }
}

async function synchronize(options = {}) {
  if (state.syncing) return;
  state.syncing = true;
  elements.syncButton.disabled = true;
  elements.syncButton.textContent = "Syncing...";
  try {
    await api("/backend-monitoring/api/sync", { method: "POST" });
    if (!options.silent) showNotice("");
    await refreshDashboard({ refreshDetail: true });
  } catch (error) {
    if (!options.silent) showNotice(error.message);
  } finally {
    state.syncing = false;
    elements.syncButton.disabled = false;
    elements.syncButton.textContent = "Sync now";
  }
}

elements.syncButton.addEventListener("click", () => synchronize());
elements.filterForm.addEventListener("submit", (event) => event.preventDefault());
for (const control of [
  elements.searchInput,
  elements.statusFilter,
  elements.languageFilter,
  elements.intentFilter,
  elements.issueFilter,
]) {
  control.addEventListener("input", () => {
    window.clearTimeout(state.filteringTimer);
    state.filteringTimer = window.setTimeout(() => loadConversations().catch((error) => showNotice(error.message)), 220);
  });
}
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-conversation-id]");
  if (target?.dataset.conversationId) selectConversation(target.dataset.conversationId);
});

async function start() {
  await refreshDashboard();
  synchronize({ silent: true });
  state.refreshTimer = window.setInterval(() => synchronize({ silent: true }), 15000);
}

start();
