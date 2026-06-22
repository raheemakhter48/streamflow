-- 1. Users Table (Custom Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Profiles Table (Extended)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  avatar_url TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for now" ON public.profiles;
CREATE POLICY "Allow public select for now" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow individual updates" ON public.profiles;
CREATE POLICY "Allow individual updates" ON public.profiles FOR UPDATE USING (true);

-- 3. IPTV Credentials Table (Master Structure)
CREATE TABLE IF NOT EXISTS public.iptv_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  provider_name TEXT,
  username TEXT,
  password TEXT,
  server_url TEXT,
  m3u_url TEXT,
  epg_url TEXT,
  m3u_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

ALTER TABLE public.iptv_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for now" ON public.iptv_credentials;
CREATE POLICY "Allow all for now" ON public.iptv_credentials FOR ALL USING (true);

-- 4. Favorites Table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  channel_name TEXT NOT NULL,
  channel_logo TEXT,
  channel_url TEXT NOT NULL,
  category TEXT,
  stream_type TEXT DEFAULT 'live',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, channel_url)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all favorites" ON public.favorites;
CREATE POLICY "Allow all favorites" ON public.favorites FOR ALL USING (true);

-- 5. Recently Watched Table
CREATE TABLE IF NOT EXISTS public.recently_watched (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  channel_name TEXT NOT NULL,
  channel_logo TEXT,
  channel_url TEXT NOT NULL,
  category TEXT,
  stream_type TEXT DEFAULT 'live',
  watched_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.recently_watched ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all history" ON public.recently_watched;
CREATE POLICY "Allow all history" ON public.recently_watched FOR ALL USING (true);

-- 6. Playlist Cache Table (Critical for Performance)
CREATE TABLE IF NOT EXISTS public.playlist_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

ALTER TABLE public.playlist_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all cache" ON public.playlist_cache;
CREATE POLICY "Allow all cache" ON public.playlist_cache FOR ALL USING (true);

-- 7. Existing Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_watched_user_id ON public.recently_watched(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_watched_time ON public.recently_watched(watched_at DESC);

-- 8. Trigger for Profile Creation
CREATE OR REPLACE FUNCTION public.handle_new_user_custom()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_custom();

-- 9. IPTV-org Extension for Fast Search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 10. IPTV-org Regions
CREATE TABLE IF NOT EXISTS public.iptv_regions (
  code VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  countries TEXT[] NOT NULL DEFAULT '{}'
);

-- 11. IPTV-org Channels
CREATE TABLE IF NOT EXISTS public.iptv_channels (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  country VARCHAR,
  category VARCHAR,
  logo_url TEXT
);

-- 12. IPTV-org Streams with Health State
CREATE TABLE IF NOT EXISTS public.iptv_streams (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR NOT NULL REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
  title TEXT,
  url TEXT NOT NULL,
  resolution VARCHAR,
  is_working BOOLEAN,
  last_checked_at TIMESTAMPTZ,
  last_status_code INTEGER,
  last_error TEXT
);

ALTER TABLE public.iptv_streams
  ADD COLUMN IF NOT EXISTS is_working BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_status_code INTEGER,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 13. IPTV-org Indexes
CREATE INDEX IF NOT EXISTS idx_iptv_regions_countries
  ON public.iptv_regions USING GIN (countries);

CREATE INDEX IF NOT EXISTS idx_iptv_channels_name_trgm
  ON public.iptv_channels USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_iptv_channels_country
  ON public.iptv_channels (country);

CREATE INDEX IF NOT EXISTS idx_iptv_channels_category
  ON public.iptv_channels (category);

CREATE INDEX IF NOT EXISTS idx_iptv_channels_country_name
  ON public.iptv_channels (country, name);

CREATE INDEX IF NOT EXISTS idx_iptv_channels_category_name
  ON public.iptv_channels (category, name);

CREATE INDEX IF NOT EXISTS idx_iptv_channels_country_category_name
  ON public.iptv_channels (country, category, name);

CREATE INDEX IF NOT EXISTS idx_iptv_streams_channel_id
  ON public.iptv_streams (channel_id);

CREATE INDEX IF NOT EXISTS idx_iptv_streams_working_channel_id
  ON public.iptv_streams (is_working, channel_id);

-- 14. Admin Console Channels
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

-- 15. Admin Console Filter Options
CREATE TABLE IF NOT EXISTS public.admin_filter_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('country', 'category')),
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(type, value)
);

-- 16. Admin Console Analytics
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

-- 17. Admin Console Indexes
CREATE INDEX IF NOT EXISTS idx_admin_channels_status
  ON public.admin_channels(status);

CREATE INDEX IF NOT EXISTS idx_admin_channels_country_category
  ON public.admin_channels(country, category);

CREATE INDEX IF NOT EXISTS idx_admin_watch_events_time
  ON public.admin_watch_events(watched_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_api_metrics_time
  ON public.admin_api_metrics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_scrape_runs_status
  ON public.admin_scrape_runs(status);

CREATE INDEX IF NOT EXISTS idx_admin_system_logs_time
  ON public.admin_system_logs(created_at DESC);

CREATE OR REPLACE FUNCTION public.get_iptv_channels_ranked(
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 30,
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_region_countries TEXT[] DEFAULT NULL,
  p_country TEXT DEFAULT NULL
)
RETURNS TABLE (
  id VARCHAR,
  name VARCHAR,
  country VARCHAR,
  category VARCHAR,
  logo_url TEXT,
  has_working_stream BOOLEAN,
  iptv_streams JSONB,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT
      c.id,
      c.name,
      c.country,
      c.category,
      c.logo_url,
      EXISTS (
        SELECT 1
        FROM public.iptv_streams ws
        WHERE ws.channel_id = c.id
          AND ws.url IS NOT NULL
          AND ws.is_working IS TRUE
      ) AS has_working_stream
    FROM public.iptv_channels c
    WHERE EXISTS (
      SELECT 1
      FROM public.iptv_streams s
      WHERE s.channel_id = c.id
        AND s.url IS NOT NULL
    )
      AND (NULLIF(p_search, '') IS NULL OR c.name ILIKE ('%' || p_search || '%'))
      AND (NULLIF(p_category, '') IS NULL OR c.category = p_category)
      AND (NULLIF(p_country, '') IS NULL OR c.country = p_country)
      AND (
        NULLIF(p_country, '') IS NOT NULL
        OR p_region_countries IS NULL
        OR cardinality(p_region_countries) = 0
        OR c.country = ANY(p_region_countries)
      )
  ),
  counted AS (
    SELECT COUNT(*) AS total_count
    FROM filtered
  ),
  paged AS (
    SELECT *
    FROM filtered
    ORDER BY has_working_stream DESC, name ASC, id ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100)
    OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100)
  )
  SELECT
    p.id,
    p.name,
    p.country,
    p.category,
    p.logo_url,
    p.has_working_stream,
    COALESCE(streams.iptv_streams, '[]'::jsonb) AS iptv_streams,
    counted.total_count
  FROM paged p
  CROSS JOIN counted
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'url', s.url,
        'resolution', s.resolution,
        'is_working', s.is_working
      )
      ORDER BY (s.is_working IS TRUE) DESC, s.id ASC
    ) AS iptv_streams
    FROM public.iptv_streams s
    WHERE s.channel_id = p.id
      AND s.url IS NOT NULL
  ) streams ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_iptv_channels_ranked(INTEGER, INTEGER, TEXT, TEXT, TEXT[], TEXT) TO anon, authenticated, service_role;

ANALYZE public.users;
ANALYZE public.profiles;
ANALYZE public.iptv_credentials;
ANALYZE public.favorites;
ANALYZE public.recently_watched;
ANALYZE public.playlist_cache;
ANALYZE public.iptv_regions;
ANALYZE public.iptv_channels;
ANALYZE public.iptv_streams;
ANALYZE public.admin_channels;
ANALYZE public.admin_filter_options;
ANALYZE public.admin_watch_events;
ANALYZE public.admin_api_metrics;
ANALYZE public.admin_scrape_runs;
ANALYZE public.admin_system_logs;

-- Reload Supabase/PostgREST schema cache
NOTIFY pgrst, 'reload schema';
