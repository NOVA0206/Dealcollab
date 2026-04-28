    -- Migration to add profile_image column to users table
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT;

-- Index for performance (optional but good practice if searching by image presence)
CREATE INDEX IF NOT EXISTS idx_users_profile_image ON users (profile_image) WHERE profile_image IS NOT NULL;
