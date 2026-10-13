ALTER TABLE coedit_submissions ADD COLUMN IF NOT EXISTS actor text;
ALTER TABLE coedit_submissions ADD COLUMN IF NOT EXISTS request_id text;
CREATE UNIQUE INDEX IF NOT EXISTS coedit_submission_request ON coedit_submissions(room_id,actor,request_id);
