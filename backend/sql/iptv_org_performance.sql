CREATE INDEX IF NOT EXISTS idx_iptv_channels_country_name
  ON public.iptv_channels (country, name);

CREATE INDEX IF NOT EXISTS idx_iptv_channels_category_name
  ON public.iptv_channels (category, name);

CREATE INDEX IF NOT EXISTS idx_iptv_channels_country_category_name
  ON public.iptv_channels (country, category, name);

ANALYZE public.iptv_regions;
ANALYZE public.iptv_channels;
ANALYZE public.iptv_streams;

NOTIFY pgrst, 'reload schema';
