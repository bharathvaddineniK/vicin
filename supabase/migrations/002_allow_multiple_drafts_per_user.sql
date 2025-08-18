-- Remove the unique constraint on user_id to allow multiple drafts per user
ALTER TABLE public.post_drafts DROP CONSTRAINT IF EXISTS post_drafts_user_id_key;

-- The table now allows multiple drafts per user
-- Each draft will have its own unique id (UUID) as the primary key
-- Users can have multiple draft versions/snapshots
