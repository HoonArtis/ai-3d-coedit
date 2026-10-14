ALTER TABLE coedit_generation_versions DROP CONSTRAINT IF EXISTS coedit_generation_versions_state_check;
ALTER TABLE coedit_generation_versions ADD CONSTRAINT coedit_generation_versions_state_check CHECK(state IN ('image_queued','awaiting_confirmation','shape_queued','shape_ready','failed','cancelled'));
ALTER TABLE coedit_generation_jobs ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'visible' CHECK(visibility IN ('visible','hidden','deleted'));
