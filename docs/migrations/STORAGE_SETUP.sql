-- ==========================================
-- SUPABASE STORAGE SETUP SCRIPT
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. Create the storage buckets (if they don't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('submission-photos', 'submission-photos', true),
  ('submission-videos', 'submission-videos', true),
  ('submission-audio', 'submission-audio', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable Row Level Security (RLS) on storage.objects
-- NOTE: This is usually enabled by default. If you get an error "must be owner of table objects", you can skip this line.
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for "submission-photos"

-- Allow authenticated users to upload photos
CREATE POLICY "Auth users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'submission-photos' );

-- Allow authenticated users to view photos (or make public)
CREATE POLICY "Public can view photos"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'submission-photos' );

-- Allow users to update/delete their own photos
CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'submission-photos' AND auth.uid() = owner );

CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'submission-photos' AND auth.uid() = owner );


-- 4. Create RLS Policies for "submission-videos"

CREATE POLICY "Auth users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'submission-videos' );

CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'submission-videos' );

CREATE POLICY "Users can update own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'submission-videos' AND auth.uid() = owner );

CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'submission-videos' AND auth.uid() = owner );


-- 5. Create RLS Policies for "submission-audio"

CREATE POLICY "Auth users can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'submission-audio' );

CREATE POLICY "Public can view audio"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'submission-audio' );

CREATE POLICY "Users can update own audio"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'submission-audio' AND auth.uid() = owner );

CREATE POLICY "Users can delete own audio"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'submission-audio' AND auth.uid() = owner );
