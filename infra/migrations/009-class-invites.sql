CREATE TABLE IF NOT EXISTS coedit_class_invites (
 class_id text PRIMARY KEY REFERENCES coedit_classes(id) ON DELETE CASCADE,
 code text NOT NULL UNIQUE,
 enabled boolean NOT NULL DEFAULT true
);
