-- Preserve already published class libraries; newly finished assets start in their own room.
ALTER TABLE coedit_generation_finishing ADD COLUMN IF NOT EXISTS shared_with_class boolean NOT NULL DEFAULT true;
ALTER TABLE coedit_generation_finishing ALTER COLUMN shared_with_class SET DEFAULT false;
UPDATE coedit_generation_finishing SET shared_with_class=false WHERE phase<>'approved' AND review_actor IS NULL;
