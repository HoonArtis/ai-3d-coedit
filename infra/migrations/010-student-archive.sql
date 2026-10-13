ALTER TABLE coedit_students ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE coedit_students DROP CONSTRAINT IF EXISTS coedit_students_room_id_ordinal_key;
CREATE UNIQUE INDEX IF NOT EXISTS coedit_active_student_seat ON coedit_students(room_id,ordinal) WHERE NOT archived;
