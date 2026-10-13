CREATE TABLE IF NOT EXISTS coedit_vr_bakes (
  snapshot_id text PRIMARY KEY REFERENCES coedit_submissions(id) ON DELETE CASCADE,
  actor text NOT NULL,
  source_key text NOT NULL CHECK(source_key ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','ready','failed')),
  manifest_id text CHECK(manifest_id ~ '^[a-f0-9]{64}$'),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((state='ready')=(manifest_id IS NOT NULL))
);
