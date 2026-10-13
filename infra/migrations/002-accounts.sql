CREATE TABLE IF NOT EXISTS coedit_teachers (
  id text PRIMARY KEY, username text NOT NULL UNIQUE, password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS coedit_classes (
  id text PRIMARY KEY, teacher_id text NOT NULL REFERENCES coedit_teachers(id) ON DELETE CASCADE,
  name text NOT NULL, generation_limit integer NOT NULL DEFAULT 3 CHECK(generation_limit BETWEEN 0 AND 100)
);
CREATE TABLE IF NOT EXISTS coedit_class_rooms (
  id text PRIMARY KEY, class_id text NOT NULL REFERENCES coedit_classes(id) ON DELETE CASCADE,
  name text NOT NULL, code text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS coedit_students (
  id text PRIMARY KEY, room_id text NOT NULL REFERENCES coedit_class_rooms(id) ON DELETE CASCADE,
  credential_hash text NOT NULL UNIQUE, ordinal integer NOT NULL,
  UNIQUE(room_id,ordinal),CHECK(ordinal BETWEEN 1 AND 5)
);
CREATE TABLE IF NOT EXISTS coedit_account_sessions (
  token_hash text PRIMARY KEY, actor text NOT NULL, role text NOT NULL CHECK(role IN ('teacher','student')),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS coedit_account_sessions_actor ON coedit_account_sessions(actor);
