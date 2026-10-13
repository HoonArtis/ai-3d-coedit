CREATE TABLE IF NOT EXISTS coedit_generation_jobs (
 id text PRIMARY KEY, actor text NOT NULL REFERENCES coedit_students(id) ON DELETE CASCADE,
 room_id text NOT NULL REFERENCES coedit_class_rooms(id) ON DELETE CASCADE,
 class_id text NOT NULL REFERENCES coedit_classes(id) ON DELETE CASCADE,
 generation integer NOT NULL CHECK(generation>=0), current_version integer NOT NULL CHECK(current_version>0)
);
CREATE TABLE IF NOT EXISTS coedit_generation_versions (
 job_id text NOT NULL REFERENCES coedit_generation_jobs(id) ON DELETE CASCADE,
 version integer NOT NULL, actor text NOT NULL REFERENCES coedit_students(id) ON DELETE CASCADE,
 request_id text NOT NULL, input jsonb NOT NULL, source jsonb NOT NULL,
 state text NOT NULL CHECK(state IN ('image_queued','awaiting_confirmation','shape_queued','shape_ready','failed')),
 image_key text,shape_key text,error text,charged boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(job_id,version),UNIQUE(actor,request_id)
);
CREATE INDEX IF NOT EXISTS coedit_generation_pending ON coedit_generation_versions(state);
