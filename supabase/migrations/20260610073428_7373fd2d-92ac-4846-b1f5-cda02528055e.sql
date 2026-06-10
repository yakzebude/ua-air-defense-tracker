
-- Add service_role-only policy for sync_runs (RLS enabled but no policies)
CREATE POLICY "Service role can manage sync runs" ON public.sync_runs
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Lock down kaggle-raw storage bucket to service_role only
CREATE POLICY "Service role can read kaggle-raw" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'kaggle-raw' AND auth.role() = 'service_role');

CREATE POLICY "Service role can insert kaggle-raw" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'kaggle-raw' AND auth.role() = 'service_role');

CREATE POLICY "Service role can update kaggle-raw" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id = 'kaggle-raw' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'kaggle-raw' AND auth.role() = 'service_role');

CREATE POLICY "Service role can delete kaggle-raw" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id = 'kaggle-raw' AND auth.role() = 'service_role');
