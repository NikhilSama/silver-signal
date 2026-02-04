-- COMEX Silver Monitor Database Schema
-- Run this SQL to create all tables in Vercel Postgres

-- Core time-series data table (append-only, never UPDATE)
CREATE TABLE IF NOT EXISTS indicator_snapshots (
  id BIGSERIAL PRIMARY KEY,
  indicator_id INTEGER NOT NULL CHECK (indicator_id >= 1 AND indicator_id <= 12),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_date DATE NOT NULL,
  raw_value JSONB NOT NULL,
  computed_value NUMERIC NOT NULL,
  signal TEXT NOT NULL CHECK (signal IN ('green', 'yellow', 'red', 'error')),
  signal_reason TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetch_status TEXT NOT NULL CHECK (fetch_status IN ('success', 'error', 'timeout', 'parse_error')),
  error_detail TEXT
);

-- Indexes for fast queries (dashboard + LLM)
CREATE INDEX IF NOT EXISTS idx_snapshots_indicator_date
  ON indicator_snapshots(indicator_id, data_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_indicator_fetched
  ON indicator_snapshots(indicator_id, fetched_at DESC);

-- Static reference table for all 12 indicators
CREATE TABLE IF NOT EXISTS indicator_metadata (
  indicator_id INTEGER PRIMARY KEY CHECK (indicator_id >= 1 AND indicator_id <= 12),
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  why_it_works TEXT NOT NULL,
  green_criteria TEXT NOT NULL,
  yellow_criteria TEXT NOT NULL,
  red_criteria TEXT NOT NULL,
  update_frequency TEXT NOT NULL,
  source_name TEXT NOT NULL
);

-- LLM-generated daily briefings
CREATE TABLE IF NOT EXISTS daily_briefings (
  id BIGSERIAL PRIMARY KEY,
  briefing_date DATE NOT NULL UNIQUE,
  overall_posture TEXT NOT NULL CHECK (overall_posture IN ('BUY', 'SELL', 'CAUTION', 'NEUTRAL', 'INSUFFICIENT_DATA')),
  posture_reason TEXT NOT NULL,
  briefing_text TEXT NOT NULL,
  indicator_summary JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefings_date ON daily_briefings(briefing_date DESC);

-- Market-critical dates (FND, COT releases, holidays)
CREATE TABLE IF NOT EXISTS key_dates (
  id BIGSERIAL PRIMARY KEY,
  event_date DATE NOT NULL,
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('FND', 'COT_RELEASE', 'CONTRACT_EXPIRY', 'HOLIDAY_WINDOW', 'OTHER')),
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_key_dates_date ON key_dates(event_date);
CREATE INDEX IF NOT EXISTS idx_key_dates_active ON key_dates(active, event_date);

-- Browser Use prompts for indicators that support browser automation
CREATE TABLE IF NOT EXISTS browser_prompts (
  indicator_id INTEGER PRIMARY KEY CHECK (indicator_id >= 1 AND indicator_id <= 12),
  prompt TEXT NOT NULL,
  target_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at TIMESTAMPTZ,
  last_run_success BOOLEAN,
  last_run_error TEXT
);
