ALTER TABLE coedit_account_sessions ADD COLUMN IF NOT EXISTS view_only boolean NOT NULL DEFAULT false;
ALTER TABLE coedit_account_sessions ADD COLUMN IF NOT EXISTS viewer_room_id text;
UPDATE coedit_account_sessions a SET viewer_room_id=s.room_id FROM coedit_students s WHERE a.view_only AND a.viewer_room_id IS NULL AND a.actor=s.id;
