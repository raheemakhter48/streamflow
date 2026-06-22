CREATE TABLE IF NOT EXISTS public.admin_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  country TEXT,
  category TEXT,
  stream_url TEXT,
  iframe_embed TEXT,
  status TEXT NOT NULL DEFAULT 'working' CHECK (status IN ('working', 'broken')),
  is_manual_override BOOLEAN NOT NULL DEFAULT false,
  last_checked_at TIMESTAMPTZ,
  last_status_code INTEGER,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_filter_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('country', 'category')),
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(type, value)
);

CREATE TABLE IF NOT EXISTS public.admin_watch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  channel_id UUID,
  channel_name TEXT NOT NULL,
  source TEXT,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_api_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  duration_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID,
  channel_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout')),
  duration_ms INTEGER,
  discovered_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'info',
  scope TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_channels_status ON public.admin_channels(status);
CREATE INDEX IF NOT EXISTS idx_admin_channels_country_category ON public.admin_channels(country, category);
CREATE INDEX IF NOT EXISTS idx_admin_watch_events_time ON public.admin_watch_events(watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_api_metrics_time ON public.admin_api_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_scrape_runs_status ON public.admin_scrape_runs(status);
CREATE INDEX IF NOT EXISTS idx_admin_system_logs_time ON public.admin_system_logs(created_at DESC);

NOTIFY pgrst, 'reload schema';
