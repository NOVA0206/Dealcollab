-- ============================================================
-- Profile Creation PRD Migration
-- Aligns users table with the updated PRD fields exactly
-- ============================================================

-- 1. Add new columns required by PRD
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS base_city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS base_country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expertise_description TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_mandates TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_attachment_url TEXT;

-- 2. Migrate existing base_location data into separate city/country fields
-- (one-time migration — splits "City, Country" format if present)
UPDATE users
SET base_city = SPLIT_PART(base_location, ',', 1),
    base_country = TRIM(SPLIT_PART(base_location, ',', 2))
WHERE base_location IS NOT NULL
  AND base_city IS NULL;

-- 3. Convert corridors from TEXT to TEXT[] if needed
-- Check if corridors is currently text, and migrate data
DO $$
BEGIN
  -- Only run if corridors is text type, not text[]
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'corridors'
      AND data_type = 'text'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE users RENAME COLUMN corridors TO corridors_old;
    ALTER TABLE users ADD COLUMN corridors TEXT[];
    UPDATE users SET corridors = string_to_array(corridors_old, ', ')
      WHERE corridors_old IS NOT NULL;
    ALTER TABLE users DROP COLUMN corridors_old;
  END IF;
END $$;

-- 4. Convert intent from TEXT to TEXT[] if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'intent'
      AND data_type = 'text'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE users RENAME COLUMN intent TO intent_old;
    ALTER TABLE users ADD COLUMN intent TEXT[];
    UPDATE users SET intent = string_to_array(intent_old, ', ')
      WHERE intent_old IS NOT NULL;
    ALTER TABLE users DROP COLUMN intent_old;
  END IF;
END $$;

-- 5. Update collaboration_model options to match PRD
-- (Revenue sharing, Deal-by-deal, Long-term partnerships)
-- No schema change needed — existing text[] column is fine

-- 6. Create storage bucket for profile attachments (run in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('profile-attachments', 'profile-attachments', true);

-- 7. Add GIN indexes for array columns used in matching
CREATE INDEX IF NOT EXISTS idx_users_sectors ON users USING GIN (sectors);
CREATE INDEX IF NOT EXISTS idx_users_intent ON users USING GIN (intent);
CREATE INDEX IF NOT EXISTS idx_users_active_mandates ON users USING GIN (active_mandates);
CREATE INDEX IF NOT EXISTS idx_users_category ON users USING GIN (category);
CREATE INDEX IF NOT EXISTS idx_users_geographies ON users USING GIN (geographies);
CREATE INDEX IF NOT EXISTS idx_users_corridors ON users USING GIN (corridors);
CREATE INDEX IF NOT EXISTS idx_users_collaboration_model ON users USING GIN (collaboration_model);

-- 8. Add index on cross_border for filtering
CREATE INDEX IF NOT EXISTS idx_users_cross_border ON users (cross_border) WHERE cross_border = true;

-- 9. Add composite index for geography-based matching
CREATE INDEX IF NOT EXISTS idx_users_location ON users (base_city, base_country);
