CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.iptv_regions (
  code VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  countries TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.iptv_channels (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  country VARCHAR,
  category VARCHAR,
  logo_url TEXT
);

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

NOTIFY pgrst, 'reload schema';
