-- Rename image_url to media_url to support both images and videos
ALTER TABLE post_comments
RENAME COLUMN image_url TO media_url;

-- Add media_type column
ALTER TABLE post_comments
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';
