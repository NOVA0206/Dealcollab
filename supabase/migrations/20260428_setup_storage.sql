-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-attachments', 'profile-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up access policies for 'avatars'
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Upload' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owner Update' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Owner Update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;


-- Set up access policies for 'profile-attachments'
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Profile' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Public Access Profile" ON storage.objects FOR SELECT USING (bucket_id = 'profile-attachments');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Upload Profile' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Authenticated Upload Profile" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-attachments' AND auth.role() = 'authenticated');
  END IF;
END $$;
