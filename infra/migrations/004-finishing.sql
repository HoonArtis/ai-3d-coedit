CREATE TABLE IF NOT EXISTS coedit_generation_finishing (
 job_id text NOT NULL, version integer NOT NULL,
 phase text NOT NULL CHECK(phase IN ('texture_queued','material_choice','optimize_queued','pending_approval','approved','rejected','failed')),
 preset text CHECK(preset IN ('wood','metal','fabric')),texture_key text,artifact_id text,error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_id,version), FOREIGN KEY(job_id,version) REFERENCES coedit_generation_versions(job_id,version) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS coedit_finishing_pending ON coedit_generation_finishing(phase);
ALTER TABLE coedit_generation_finishing ADD COLUMN IF NOT EXISTS stale_scene boolean NOT NULL DEFAULT false;
