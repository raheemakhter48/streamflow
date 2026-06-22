-- Add scraper fields to admin_channels
ALTER TABLE public.admin_channels
  ADD COLUMN IF NOT EXISTS scrape_source_url TEXT,
  ADD COLUMN IF NOT EXISTS scraper_type TEXT DEFAULT 'generic';

-- Index so cron only fetches auto-scrape channels quickly
CREATE INDEX IF NOT EXISTS idx_admin_channels_scrape
  ON public.admin_channels(scraper_type)
  WHERE scrape_source_url IS NOT NULL AND is_manual_override = false;

NOTIFY pgrst, 'reload schema';
