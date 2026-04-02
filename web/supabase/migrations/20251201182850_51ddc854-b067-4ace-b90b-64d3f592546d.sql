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

-- 7. Indexes for Performance
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
