ALTER TABLE public.iptv_streams
  ADD COLUMN IF NOT EXISTS is_working BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_status_code INTEGER,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_iptv_streams_working_channel_id
  ON public.iptv_streams (is_working, channel_id);

ANALYZE public.iptv_streams;

NOTIFY pgrst, 'reload schema';
