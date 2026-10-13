CREATE TABLE IF NOT EXISTS coedit_rooms (
  id text PRIMARY KEY,
  seq bigint NOT NULL CHECK(seq>=0),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((state->'snapshot'->>'roomId')=id),
  CHECK((state->'snapshot'->>'seq')::bigint=seq)
);
CREATE TABLE IF NOT EXISTS coedit_commands (
  room_id text NOT NULL REFERENCES coedit_rooms(id) ON DELETE CASCADE,
  seq bigint NOT NULL CHECK(seq>0),
  actor text NOT NULL,
  request_id text NOT NULL,
  fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(room_id,seq),
  UNIQUE(room_id,actor,request_id)
);
CREATE TABLE IF NOT EXISTS coedit_submissions (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES coedit_rooms(id) ON DELETE CASCADE,
  seq bigint NOT NULL CHECK(seq>=0),
  generation bigint NOT NULL CHECK(generation>=0),
  object_key text NOT NULL CHECK(object_key ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
