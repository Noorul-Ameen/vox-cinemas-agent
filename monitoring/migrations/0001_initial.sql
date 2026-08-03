CREATE TABLE IF NOT EXISTS conversations (
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
);

CREATE INDEX IF NOT EXISTS idx_conversations_started_at ON conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_issues ON conversations(tool_error_count, expected_missing_count, started_at DESC);

CREATE TABLE IF NOT EXISTS tool_activity (
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
);

CREATE INDEX IF NOT EXISTS idx_tool_activity_conversation ON tool_activity(conversation_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_tool_activity_status ON tool_activity(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS expected_tools (
  conversation_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  expectation TEXT NOT NULL,
  observed_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(conversation_id, tool_name),
  FOREIGN KEY(conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_expected_tools_missing ON expected_tools(expectation, observed_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS interaction_logs (
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
);

CREATE INDEX IF NOT EXISTS idx_interaction_logs_conversation ON interaction_logs(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_level ON interaction_logs(level, created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_receipts (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  conversation_id TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  processing_status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  state_key TEXT PRIMARY KEY,
  state_value TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
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
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at DESC);
