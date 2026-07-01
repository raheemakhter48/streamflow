import express from 'express';
import os from 'os';
import axios from 'axios';
import { requireAdmin } from '../middleware/admin.js';
import supabase from '../config/supabase.js';

const router = express.Router();

const normalizeText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const toSlug = (value) => normalizeText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const parseLimit = (value, fallback = 50) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : fallback;
};

const parseStatus = (value) => {
  return ['working', 'broken'].includes(value) ? value : 'all';
};

const parseManagedId = (id) => {
  const parts = String(id || '').split(':');
  if (parts[0] !== 'iptv' || !parts[1]) return null;

  return {
    channelId: parts[1],
    streamId: parts[2] ? Number.parseInt(parts[2], 10) : null
  };
};

const sortStreams = (streams = []) => {
  return [...streams]
    .filter((stream) => stream?.url)
    .sort((a, b) => Number(b?.is_working === true) - Number(a?.is_working === true));
};

const normalizeIptvChannel = (channel) => {
  const streams = sortStreams(channel.iptv_streams || []);
  const primaryStream = streams[0] || null;
  const hasWorkingStream = streams.some((stream) => stream.is_working === true);

  return {
    id: `iptv:${channel.id}:${primaryStream?.id || ''}`,
    source_id: channel.id,
    stream_id: primaryStream?.id || null,
    source_type: 'iptv',
    name: channel.name,
    slug: channel.id,
    logo_url: channel.logo_url,
    country: channel.country,
    category: channel.category,
    stream_url: primaryStream?.url || null,
    iframe_embed: null,
    status: hasWorkingStream ? 'working' : 'broken',
    is_manual_override: false,
    source_label: 'IPTV-org',
    last_checked_at: primaryStream?.last_checked_at || null,
    last_status_code: primaryStream?.last_status_code || null,
    last_error: primaryStream?.last_error || null,
    created_at: null,
    updated_at: null
  };
};

const createLog = async ({ level = 'info', scope, message, details = null }) => {
  await supabase.from('admin_system_logs').insert({
    level,
    scope,
    message,
    details
  });
};

const loadScraper = async () => {
  try {
    const scraperModule = await import('../scrapers/index.js');
    return scraperModule.scrapeChannel;
  } catch (error) {
    const message = error?.code === 'ERR_MODULE_NOT_FOUND'
      ? 'Scraper dependencies are not installed. Manual channel editing and health checks still work.'
      : error.message;
    const unavailableError = new Error(message);
    unavailableError.statusCode = 503;
    throw unavailableError;
  }
};

const VALID_SCRAPER_TYPES = ['generic', 'crictime', 'streameast', 'sportsurge'];

const validateChannelPayload = (body) => {
  const name = normalizeText(body.name);
  const streamUrl = normalizeText(body.streamUrl);
  const iframeEmbed = normalizeText(body.iframeEmbed);
  const scrapeSourceUrl = normalizeText(body.scrapeSourceUrl);
  const manualOverride = Boolean(body.isManualOverride);

  if (!name) {
    return { error: 'Channel name is required' };
  }

  if (manualOverride && !streamUrl && !iframeEmbed) {
    return { error: 'Manual override requires a stream URL or iframe embed' };
  }

  if (!manualOverride && !scrapeSourceUrl) {
    return { error: 'Auto-scrape channels require a Scrape Source URL' };
  }

  return {
    data: {
      name,
      slug: normalizeText(body.slug) || toSlug(name),
      logo_url: normalizeText(body.logoUrl) || null,
      country: normalizeText(body.country) || null,
      category: normalizeText(body.category) || null,
      stream_url: streamUrl || null,
      iframe_embed: iframeEmbed || null,
      scrape_source_url: scrapeSourceUrl || null,
      scraper_type: VALID_SCRAPER_TYPES.includes(body.scraperType) ? body.scraperType : 'generic',
      status: body.status === 'broken' ? 'broken' : 'working',
      is_manual_override: manualOverride,
      updated_at: new Date().toISOString()
    }
  };
};

router.use(requireAdmin);

router.get('/channels', async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeText(req.query.search);
    const status = parseStatus(req.query.status);

    let adminQuery = supabase
      .from('admin_channels')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .limit(25);

    if (search) {
      adminQuery = adminQuery.or(`name.ilike.%${search}%,country.ilike.%${search}%,category.ilike.%${search}%`);
    }

    if (status !== 'all') {
      adminQuery = adminQuery.eq('status', status);
    }

    let iptvQuery = supabase
      .from('iptv_channels')
      .select(`
        id,
        name,
        country,
        category,
        logo_url,
        iptv_streams!inner (
          id,
          title,
          url,
          resolution,
          is_working,
          last_checked_at,
          last_status_code,
          last_error
        )
      `, { count: 'exact' })
      .not('iptv_streams.url', 'is', null)
      .order('name', { ascending: true })
      .range(from, to);

    if (search) {
      iptvQuery = iptvQuery.or(`name.ilike.%${search}%,country.ilike.%${search}%,category.ilike.%${search}%`);
    }

    if (status === 'working') {
      iptvQuery = iptvQuery.eq('iptv_streams.is_working', true);
    }

    if (status === 'broken') {
      iptvQuery = iptvQuery.or('is_working.is.false,is_working.is.null', { foreignTable: 'iptv_streams' });
    }

    const [
      { data: adminData, error: adminError, count: adminCount },
      { data: iptvData, error: iptvError, count: iptvCount }
    ] = await Promise.all([adminQuery, iptvQuery]);

    if (adminError) throw adminError;
    if (iptvError) throw iptvError;

    const adminRows = (adminData || []).map((channel) => ({
      ...channel,
      source_type: 'admin',
      source_label: channel.is_manual_override ? 'Manual' : 'Admin'
    }));

    const iptvRows = (iptvData || []).map(normalizeIptvChannel);

    res.json({
      success: true,
      total: (adminCount || 0) + (iptvCount || 0),
      page,
      data: [...adminRows, ...iptvRows].slice(0, limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/channels', async (req, res) => {
  try {
    const payload = validateChannelPayload(req.body);
    if (payload.error) {
      return res.status(400).json({ success: false, message: payload.error });
    }

    const { data, error } = await supabase
      .from('admin_channels')
      .insert(payload.data)
      .select()
      .single();

    if (error) throw error;

    await createLog({
      scope: 'channels',
      message: `Created channel ${data.name}`,
      details: { channelId: data.id }
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/channels/:id', async (req, res) => {
  try {
    const managedId = parseManagedId(req.params.id);
    if (managedId) {
      const name = normalizeText(req.body.name);
      const streamUrl = normalizeText(req.body.streamUrl);
      const status = req.body.status === 'broken' ? 'broken' : 'working';

      if (!name) {
        return res.status(400).json({ success: false, message: 'Channel name is required' });
      }

      const { error: channelError } = await supabase
        .from('iptv_channels')
        .update({
          name,
          logo_url: normalizeText(req.body.logoUrl) || null,
          country: normalizeText(req.body.country) || null,
          category: normalizeText(req.body.category) || null
        })
        .eq('id', managedId.channelId);

      if (channelError) throw channelError;

      if (managedId.streamId && streamUrl) {
        const { data: previousStream, error: previousStreamError } = await supabase
          .from('iptv_streams')
          .select('id, channel_id, url')
          .eq('id', managedId.streamId)
          .eq('channel_id', managedId.channelId)
          .maybeSingle();

        if (previousStreamError) throw previousStreamError;
        if (!previousStream) {
          return res.status(404).json({
            success: false,
            message: 'The selected IPTV stream no longer exists. Refresh and try again.'
          });
        }

        const { error: streamError } = await supabase
          .from('iptv_streams')
          .update({
            url: streamUrl,
            is_working: status === 'working',
            last_checked_at: new Date().toISOString(),
            last_error: null
          })
          .eq('id', managedId.streamId)
          .eq('channel_id', managedId.channelId);

        if (streamError) throw streamError;

        // Keep user-facing references in sync when an admin replaces a dead URL.
        if (previousStream.url && previousStream.url !== streamUrl) {
          const referenceUpdates = await Promise.all([
            supabase
              .from('recently_watched')
              .update({ channel_url: streamUrl })
              .eq('channel_url', previousStream.url),
            supabase
              .from('favorites')
              .update({ channel_url: streamUrl })
              .eq('channel_url', previousStream.url)
          ]);

          referenceUpdates
            .filter((result) => result.error)
            .forEach((result) => console.warn('Could not sync a saved channel URL:', result.error.message));
        }
      }

      await createLog({
        scope: 'channels',
        message: `Updated IPTV channel ${name}`,
        details: { channelId: managedId.channelId, streamId: managedId.streamId, status }
      });

      return res.json({
        success: true,
        data: {
          id: req.params.id,
          name,
          status,
          stream_url: streamUrl || null,
          source_type: 'iptv',
          source_label: 'IPTV-org'
        }
      });
    }

    const payload = validateChannelPayload(req.body);
    if (payload.error) {
      return res.status(400).json({ success: false, message: payload.error });
    }

    const { data, error } = await supabase
      .from('admin_channels')
      .update(payload.data)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await createLog({
      scope: 'channels',
      message: `Updated channel ${data.name}`,
      details: { channelId: data.id }
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/channels/:id', async (req, res) => {
  try {
    if (parseManagedId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'IPTV-org channels cannot be deleted here. Mark it broken or replace the stream URL instead.'
      });
    }

    const { error } = await supabase
      .from('admin_channels')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    await createLog({
      scope: 'channels',
      message: 'Deleted channel',
      details: { channelId: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/filters', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_filter_options')
      .select('*')
      .order('type', { ascending: true })
      .order('label', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/filters', async (req, res) => {
  try {
    const type = normalizeText(req.body.type);
    const label = normalizeText(req.body.label);

    if (!['country', 'category'].includes(type) || !label) {
      return res.status(400).json({
        success: false,
        message: 'Valid type and label are required'
      });
    }

    const { data, error } = await supabase
      .from('admin_filter_options')
      .upsert({
        type,
        label,
        value: normalizeText(req.body.value) || toSlug(label).toUpperCase(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'type,value' })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/analytics/summary', async (req, res) => {
  try {
    const [
      { count: adminChannels },
      { count: adminBroken },
      { count: iptvChannels },
      { count: iptvWorking },
      { data: topChannels },
      { data: scrapeStats }
    ] = await Promise.all([
      supabase.from('admin_channels').select('id', { count: 'exact', head: true }),
      supabase.from('admin_channels').select('id', { count: 'exact', head: true }).eq('status', 'broken'),
      supabase.from('iptv_channels').select('id, iptv_streams!inner(url)', { count: 'exact', head: true }).not('iptv_streams.url', 'is', null),
      supabase.from('iptv_channels').select('id, iptv_streams!inner(is_working)', { count: 'exact', head: true }).eq('iptv_streams.is_working', true),
      supabase.from('admin_watch_events').select('channel_name, watched_at').order('watched_at', { ascending: false }).limit(500),
      supabase.from('admin_scrape_runs').select('status').limit(1000)
    ]);

    const topMap = new Map();
    (topChannels || []).forEach((row) => {
      topMap.set(row.channel_name, (topMap.get(row.channel_name) || 0) + 1);
    });

    const scrapeMap = { success: 0, failed: 0, timeout: 0 };
    (scrapeStats || []).forEach((row) => {
      scrapeMap[row.status] = (scrapeMap[row.status] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        channelCount: (adminChannels || 0) + (iptvChannels || 0),
        brokenCount: (adminBroken || 0) + Math.max((iptvChannels || 0) - (iptvWorking || 0), 0),
        topChannels: [...topMap.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        scrapeStats: scrapeMap
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/analytics/system', async (req, res) => {
  try {
    const memory = process.memoryUsage();
    const cpuLoad = os.loadavg()[0];
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        cpuLoad,
        memoryUsedMb: Math.round(memory.rss / 1024 / 1024),
        systemMemoryUsedPercent: Number((((totalMemory - freeMemory) / totalMemory) * 100).toFixed(2)),
        uptimeSeconds: Math.round(process.uptime())
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/streams/health-check', async (req, res) => {
  try {
    const { data: channels, error } = await supabase
      .from('admin_channels')
      .select('id, name, stream_url')
      .not('stream_url', 'is', null)
      .limit(parseLimit(req.body.limit, 25));

    if (error) throw error;

    const results = [];

    for (const channel of channels || []) {
      const startedAt = Date.now();
      let status = 'broken';
      let statusCode = null;
      let errorMessage = null;

      try {
        const response = await axios.get(channel.stream_url, {
          timeout: 8000,
          headers: {
            Range: 'bytes=0-1024',
            'User-Agent': 'VLC/3.0.11'
          },
          validateStatus: () => true
        });
        statusCode = response.status;
        status = response.status >= 200 && response.status < 400 ? 'working' : 'broken';
        response.data?.destroy?.();
      } catch (streamError) {
        errorMessage = streamError.message;
      }

      await supabase
        .from('admin_channels')
        .update({
          status,
          last_checked_at: new Date().toISOString(),
          last_status_code: statusCode,
          last_error: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', channel.id);

      results.push({
        id: channel.id,
        name: channel.name,
        status,
        statusCode,
        durationMs: Date.now() - startedAt
      });
    }

    await createLog({
      scope: 'health',
      message: `Health checked ${results.length} admin channels`,
      details: { results }
    });

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseLimit(req.query.limit, 100));

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DAU + view trend — groups admin_watch_events by calendar day
router.get('/analytics/dau', async (req, res) => {
  try {
    const days = Math.min(Number.parseInt(req.query.days || '7', 10), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('admin_watch_events')
      .select('watched_at, user_id')
      .gte('watched_at', since)
      .order('watched_at', { ascending: true });

    if (error) throw error;

    const byDay = {};
    for (const row of data || []) {
      const date = row.watched_at.split('T')[0];
      if (!byDay[date]) byDay[date] = { date, views: 0, uniqueUsers: new Set() };
      byDay[date].views++;
      if (row.user_id) byDay[date].uniqueUsers.add(row.user_id);
    }

    // Fill every day in the window so the chart has a continuous x-axis
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      result.push({
        date,
        views: byDay[date]?.views || 0,
        uniqueUsers: byDay[date] ? byDay[date].uniqueUsers.size : 0
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API latency metrics — per-route averages + recent trend
router.get('/analytics/api-metrics', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_api_metrics')
      .select('route, method, status_code, duration_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const routeMap = new Map();
    for (const row of data || []) {
      const key = `${row.method}:${row.route}`;
      if (!routeMap.has(key)) {
        routeMap.set(key, { route: row.route, method: row.method, total: 0, totalMs: 0, errors: 0 });
      }
      const entry = routeMap.get(key);
      entry.total++;
      entry.totalMs += row.duration_ms;
      if (row.status_code >= 400) entry.errors++;
    }

    const routeStats = [...routeMap.values()]
      .map(e => ({ ...e, avgMs: Math.round(e.totalMs / e.total) }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10);

    // Last 60 requests as a latency sparkline
    const trend = (data || []).slice(0, 60).reverse().map((row, i) => ({
      i,
      ms: row.duration_ms,
      route: row.route
    }));

    res.json({ success: true, data: { routeStats, trend } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Seed filter options from existing IPTV-org channel data
router.post('/filters/seed-from-iptv', async (req, res) => {
  try {
    // Get distinct countries and categories from iptv_channels
    const { data: channelData, error: channelError } = await supabase
      .from('iptv_channels')
      .select('country, category');

    if (channelError) throw channelError;

    const countries  = [...new Set((channelData || []).map(r => r.country).filter(Boolean))].sort();
    const categories = [...new Set((channelData || []).map(r => r.category).filter(Boolean))].sort();

    const countryRows  = countries.map(c => ({
      type: 'country', label: c, value: c.toUpperCase().replace(/\s+/g, '_'), updated_at: new Date().toISOString()
    }));
    const categoryRows = categories.map(c => ({
      type: 'category', label: c, value: c.toLowerCase().replace(/\s+/g, '_'), updated_at: new Date().toISOString()
    }));

    const allRows = [...countryRows, ...categoryRows];

    // Upsert in batches of 500
    let inserted = 0;
    for (let i = 0; i < allRows.length; i += 500) {
      const batch = allRows.slice(i, i + 500);
      const { error } = await supabase
        .from('admin_filter_options')
        .upsert(batch, { onConflict: 'type,value', ignoreDuplicates: true });
      if (error) throw error;
      inserted += batch.length;
    }

    await createLog({
      scope: 'filters',
      message: `Seeded ${countries.length} countries + ${categories.length} categories from IPTV-org data`
    });

    res.json({
      success: true,
      data: { countries: countries.length, categories: categories.length, total: inserted }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a filter option (country or category)
router.delete('/filters/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('admin_filter_options')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Scraper endpoints ────────────────────────────────────────────────────────

// Trigger an immediate scrape for one admin channel
router.post('/scrape/channel/:id', async (req, res) => {
  try {
    const { data: channel, error } = await supabase
      .from('admin_channels')
      .select('id, name, scrape_source_url, scraper_type, is_manual_override')
      .eq('id', req.params.id)
      .single();

    if (error || !channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    if (channel.is_manual_override) {
      return res.status(400).json({ success: false, message: 'Channel is set to manual override — scraping disabled' });
    }

    if (!channel.scrape_source_url) {
      return res.status(400).json({ success: false, message: 'No scrape source URL configured for this channel' });
    }

    const scrape = await loadScraper();
    const result = await scrape(channel);

    const status = result.success
      ? 'success'
      : result.error?.toLowerCase().includes('timeout') ? 'timeout' : 'failed';

    await supabase
      .from('admin_channels')
      .update({
        stream_url: result.url || null,
        status: result.success ? 'working' : 'broken',
        last_error: result.error || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channel.id);

    await supabase.from('admin_scrape_runs').insert({
      channel_id: channel.id,
      channel_name: channel.name,
      status,
      duration_ms: result.durationMs || null,
      discovered_url: result.url || null,
      error: result.error || null,
    });

    await createLog({
      scope: 'scraper',
      level: result.success ? 'info' : 'warn',
      message: `Manual scrape: ${channel.name} → ${status}`,
      details: { url: result.url, durationMs: result.durationMs }
    });

    res.json({ success: true, data: { status, url: result.url, durationMs: result.durationMs } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Scrape all auto-channels in sequence (returns immediately, runs in background)
router.post('/scrape/bulk', async (req, res) => {
  try {
    const { data: channels, error } = await supabase
      .from('admin_channels')
      .select('id, name, scrape_source_url, scraper_type')
      .not('scrape_source_url', 'is', null)
      .eq('is_manual_override', false)
      .limit(50);

    if (error) throw error;

    if (!channels || channels.length === 0) {
      return res.json({ success: true, message: 'No auto-scrape channels configured', queued: 0 });
    }

    // Respond immediately, run scraping in the background
    res.json({ success: true, message: `Scraping ${channels.length} channel(s) in background`, queued: channels.length });

    // Fire-and-forget the actual scraping
    (async () => {
      let scrape;
      try { scrape = await loadScraper(); } catch { return; }
      for (const channel of channels) {
        try {
          const result = await scrape(channel);
          const status = result.success ? 'success' : (result.error?.includes('timeout') ? 'timeout' : 'failed');

          await supabase.from('admin_channels').update({
            stream_url: result.url || null,
            status: result.success ? 'working' : 'broken',
            last_error: result.error || null,
            updated_at: new Date().toISOString(),
          }).eq('id', channel.id);

          await supabase.from('admin_scrape_runs').insert({
            channel_id: channel.id, channel_name: channel.name, status,
            duration_ms: result.durationMs || null, discovered_url: result.url || null, error: result.error || null,
          });
        } catch { /* continue with next channel */ }
      }
    })();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Recent scrape run results
router.get('/scrape/history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_scrape_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseLimit(req.query.limit, 50));

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
