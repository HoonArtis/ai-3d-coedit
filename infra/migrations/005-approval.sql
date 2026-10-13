ALTER TABLE coedit_generation_finishing ADD COLUMN IF NOT EXISTS review_actor text;
ALTER TABLE coedit_generation_finishing ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS coedit_artifact_identity ON coedit_generation_finishing(artifact_id) WHERE artifact_id IS NOT NULL;
