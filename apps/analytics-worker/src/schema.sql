-- OneMark analytics schema (ADR-0019) — aggregate counters only.
-- There is no table here that could hold a visitor, an IP or a free-text value.

CREATE TABLE IF NOT EXISTS counters (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  prop_key TEXT NOT NULL,
  prop_value TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (day, event, prop_key, prop_value)
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
