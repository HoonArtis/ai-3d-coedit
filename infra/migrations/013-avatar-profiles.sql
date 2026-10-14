CREATE TABLE IF NOT EXISTS coedit_avatar_profiles (
 room_id text NOT NULL REFERENCES coedit_class_rooms(id) ON DELETE CASCADE,
 actor text NOT NULL,
 profile jsonb NOT NULL,
 PRIMARY KEY(room_id,actor)
);
