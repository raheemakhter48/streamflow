# SEO and Revenue Setup

This app now has a basic SEO and ad-revenue foundation. It does not generate revenue by itself until a real domain, legal content position, traffic, and approved ad accounts are connected.

## Environment variables

Create the production environment variables in your hosting panel:

```env
VITE_PUBLIC_SITE_URL=https://your-domain.com
VITE_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
VITE_ADSENSE_DASHBOARD_SLOT=1234567890
VITE_ADSENSE_MOVIE_SIDEBAR_SLOT=1234567890
```

Leave the AdSense variables empty until Google approves the site. Empty values show harmless placeholders instead of loading ads.

## Sitemap environment variables

Set these on the backend deployment:

```env
PUBLIC_SITE_URL=https://your-domain.com
SITEMAP_TMDB_REGION=PK
SITEMAP_TMDB_PAGES=3
SITEMAP_CATEGORY_LIMIT=200
SITEMAP_CACHE_SECONDS=3600
```

Optional switches:

```env
SITEMAP_INCLUDE_TMDB=false
SITEMAP_INCLUDE_IPTV=false
```

The backend exposes both `/sitemap.xml` and `/seo/sitemap.xml`. Submit `https://your-domain.com/sitemap.xml` in Google Search Console.

If the frontend and backend are on different domains, proxy `/sitemap.xml` and `/robots.txt` from the frontend domain to the backend routes, or submit the backend domain only for URLs that actually live on that backend domain.

## SEO checklist

1. Buy/connect a clean domain and set `VITE_PUBLIC_SITE_URL`.
2. Add the domain to Google Search Console.
3. Submit `/robots.txt`.
4. Create public, indexable pages for content that does not require login.
5. Keep each page title and description unique.
6. Add useful text content around movies/channels, not only embedded players.
7. Track traffic with Google Analytics or another analytics tool.

## Revenue checklist

1. Apply for Google AdSense after the domain has real pages and traffic.
2. Add `ads.txt` only after AdSense gives the exact publisher line.
3. Put banner/native ads on listing and detail pages first.
4. Use video ads only if you have legal rights to the video streams.
5. Add a paid no-ads plan once free traffic exists.

## Important policy note

AdSense and AdMob can reject or disable accounts for copyrighted movies, unauthorized live sports, scraped streams, or thin pages with mostly embedded video. The safest revenue path is licensed content, official trailers, legal availability data, original descriptions, and a subscription/no-ads upgrade.
