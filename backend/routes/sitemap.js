import express from 'express';
import '../config/env.js';
import axios from 'axios';
import supabase from '../config/supabase.js';

const router = express.Router();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MAX_TMDB_PAGES = Math.min(Number.parseInt(process.env.SITEMAP_TMDB_PAGES || '3', 10) || 3, 10);
const MAX_CATEGORY_URLS = Math.min(Number.parseInt(process.env.SITEMAP_CATEGORY_LIMIT || '200', 10) || 200, 500);
const CACHE_MAX_AGE_SECONDS = Number.parseInt(process.env.SITEMAP_CACHE_SECONDS || '3600', 10) || 3600;

const getSiteUrl = (req) => {
  const configuredUrl =
    process.env.PUBLIC_SITE_URL ||
    process.env.VITE_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    '';

  if (configuredUrl.trim()) {
    return configuredUrl.trim().replace(/\/$/, '');
  }

  return `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
};

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const toSitemapUrl = ({ loc, lastmod, changefreq = 'weekly', priority = '0.6' }) => {
  const lastmodXml = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : '';

  return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmodXml}
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>`;
};

const getTmdbAuth = () => {
  const token = String(process.env.TMDB_API_TOKEN || '').trim();
  const apiKey = String(process.env.TMDB_API_KEY || '').trim();

  if (!token && !apiKey) return null;

  return {
    headers: token
      ? { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      : { Accept: 'application/json' },
    apiKey
  };
};

const fetchTmdbMovieUrls = async (siteUrl) => {
  if (process.env.SITEMAP_INCLUDE_TMDB === 'false') {
    return [];
  }

  const auth = getTmdbAuth();
  if (!auth) return [];

  const categories = ['popular', 'top_rated', 'now_playing'];
  const seen = new Set();
  const urls = [];

  for (const category of categories) {
    for (let page = 1; page <= MAX_TMDB_PAGES; page += 1) {
      try {
        const response = await axios.get(`${TMDB_BASE_URL}/movie/${category}`, {
          timeout: 10000,
          headers: auth.headers,
          params: {
            page,
            language: 'en-US',
            region: process.env.SITEMAP_TMDB_REGION || 'PK',
            ...(auth.apiKey ? { api_key: auth.apiKey } : {})
          }
        });

        for (const movie of response.data?.results || []) {
          if (!movie?.id || !movie?.title || seen.has(movie.id)) continue;
          seen.add(movie.id);
          urls.push({
            loc: `${siteUrl}/movie/${encodeURIComponent(movie.id)}`,
            lastmod: movie.release_date || undefined,
            changefreq: category === 'now_playing' ? 'daily' : 'weekly',
            priority: category === 'popular' ? '0.8' : '0.7'
          });
        }
      } catch (error) {
        console.warn(`Sitemap TMDB ${category} page ${page} skipped: ${error.message}`);
        break;
      }
    }
  }

  return urls;
};

const fetchIptvCategoryUrls = async (siteUrl) => {
  const hasSupabaseConfig = Boolean(
    process.env.SUPABASE_URL &&
    (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY
    )
  );

  if (!hasSupabaseConfig || process.env.SITEMAP_INCLUDE_IPTV === 'false') {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('iptv_channels')
      .select('category, country')
      .not('category', 'is', null)
      .limit(5000);

    if (error) throw error;

    const categories = [...new Set((data || [])
      .map((row) => row.category)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_CATEGORY_URLS);

    const countries = [...new Set((data || [])
      .map((row) => row.country)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_CATEGORY_URLS);

    return [
      ...categories.map((category) => ({
        loc: `${siteUrl}/dashboard?view=live&category=${encodeURIComponent(category)}`,
        changefreq: 'weekly',
        priority: '0.5'
      })),
      ...countries.map((country) => ({
        loc: `${siteUrl}/dashboard?view=live&country=${encodeURIComponent(country)}`,
        changefreq: 'weekly',
        priority: '0.5'
      }))
    ];
  } catch (error) {
    console.warn(`Sitemap IPTV URLs skipped: ${error.message}`);
    return [];
  }
};

const buildSitemap = async (req) => {
  const siteUrl = getSiteUrl(req);
  const now = new Date().toISOString();
  const staticUrls = [
    { loc: `${siteUrl}/`, lastmod: now, changefreq: 'daily', priority: '1.0' },
    { loc: `${siteUrl}/dashboard?view=movie`, lastmod: now, changefreq: 'daily', priority: '0.8' },
    { loc: `${siteUrl}/dashboard?view=live`, lastmod: now, changefreq: 'daily', priority: '0.7' }
  ];

  const [movieUrls, iptvUrls] = await Promise.all([
    fetchTmdbMovieUrls(siteUrl),
    fetchIptvCategoryUrls(siteUrl)
  ]);

  const seen = new Set();
  const urls = [...staticUrls, ...movieUrls, ...iptvUrls].filter((item) => {
    if (seen.has(item.loc)) return false;
    seen.add(item.loc);
    return true;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(toSitemapUrl).join('\n')}
</urlset>`;
};

const sendSitemap = async (req, res, next) => {
  try {
    const xml = await buildSitemap(req);
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE_SECONDS}`
    });
    res.send(xml);
  } catch (error) {
    next(error);
  }
};

router.get('/sitemap.xml', sendSitemap);
router.get('/seo/sitemap.xml', sendSitemap);

router.get('/robots.txt', (req, res) => {
  const siteUrl = getSiteUrl(req);
  res.type('text/plain').send(`User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`);
});

export default router;
