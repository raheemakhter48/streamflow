import 'dotenv/config';
import axios from 'axios';
import supabase from '../config/supabase.js';

const ENDPOINTS = {
  channels: 'https://iptv-org.github.io/api/channels.json',
  streams: 'https://iptv-org.github.io/api/streams.json',
  logos: 'https://iptv-org.github.io/api/logos.json',
  regions: 'https://iptv-org.github.io/api/regions.json'
};

const CHANNEL_BATCH_SIZE = 1000;
const STREAM_BATCH_SIZE = 2000;

const fetchJson = async (label, url) => {
  const response = await axios.get(url, {
    timeout: 120000,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'StreamVault-IPTV-Sync/1.0'
    }
  });

  if (!Array.isArray(response.data)) {
    throw new Error(`${label} endpoint returned invalid JSON payload`);
  }

  return response.data;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const normalizeText = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const normalizeCountry = (value) => {
  if (Array.isArray(value)) return normalizeCountry(value[0]);
  if (typeof value === 'object' && value !== null) {
    return normalizeCountry(value.code || value.id || value.name);
  }
  const normalized = normalizeText(value);
  return normalized ? normalized.toUpperCase() : null;
};

const normalizeCategory = (value) => {
  if (Array.isArray(value)) return normalizeCategory(value[0]);
  if (typeof value === 'object' && value !== null) {
    return normalizeCategory(value.name || value.id || value.code);
  }
  return normalizeText(value);
};

const normalizeCountries = (countries) => {
  if (!Array.isArray(countries)) return [];
  return countries
    .map((country) => normalizeCountry(country))
    .filter(Boolean);
};

const buildLogoMap = (logos) => {
  const logoMap = new Map();

  for (const logo of logos) {
    const channelId = normalizeText(
      logo.channel ||
      logo.channel_id ||
      logo.channelId ||
      logo.id
    );
    const logoUrl = normalizeText(
      logo.url ||
      logo.logo ||
      logo.logo_url ||
      logo.src
    );

    if (channelId && logoUrl && !logoMap.has(channelId)) {
      logoMap.set(channelId, logoUrl);
    }
  }

  return logoMap;
};

const syncRegions = async (regions) => {
  const rows = regions
    .map((region) => ({
      code: normalizeText(region.code || region.id)?.toUpperCase(),
      name: normalizeText(region.name),
      countries: normalizeCountries(region.countries)
    }))
    .filter((region) => region.code && region.name);

  if (rows.length === 0) {
    console.log('No regions to sync.');
    return;
  }

  const { error } = await supabase
    .from('iptv_regions')
    .upsert(rows, { onConflict: 'code' });

  if (error) throw new Error(`Failed to sync regions: ${error.message}`);
  console.log(`Synced ${rows.length} regions.`);
};

const syncChannels = async (channels, logoMap) => {
  const rows = channels
    .map((channel) => {
      const id = normalizeText(channel.id || channel.channel);
      const name = normalizeText(channel.name);

      return {
        id,
        name,
        country: normalizeCountry(channel.country || channel.country_code),
        category: normalizeCategory(channel.category || channel.categories),
        logo_url: normalizeText(channel.logo || channel.logo_url) || logoMap.get(id) || null
      };
    })
    .filter((channel) => channel.id && channel.name);

  const chunks = chunkArray(rows, CHANNEL_BATCH_SIZE);

  for (let index = 0; index < chunks.length; index += 1) {
    const { error } = await supabase
      .from('iptv_channels')
      .upsert(chunks[index], { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to sync channel batch ${index + 1}/${chunks.length}: ${error.message}`);
    }

    console.log(`Synced channel batch ${index + 1}/${chunks.length} (${chunks[index].length} rows).`);
  }

  console.log(`Synced ${rows.length} channels.`);
  return new Set(rows.map((channel) => channel.id));
};

const wipeStreams = async () => {
  const { error } = await supabase
    .from('iptv_streams')
    .delete()
    .gte('id', 0);

  if (error) throw new Error(`Failed to wipe iptv_streams: ${error.message}`);
  console.log('Wiped iptv_streams.');
};

const syncStreams = async (streams, validChannelIds) => {
  const rows = streams
    .map((stream) => ({
      channel_id: normalizeText(stream.channel || stream.channel_id || stream.channelId),
      title: normalizeText(stream.title || stream.name),
      url: normalizeText(stream.url),
      resolution: normalizeText(stream.resolution || stream.quality),
      is_working: null,
      last_checked_at: null,
      last_status_code: null,
      last_error: null
    }))
    .filter((stream) => stream.channel_id && stream.url && validChannelIds.has(stream.channel_id));

  const chunks = chunkArray(rows, STREAM_BATCH_SIZE);

  for (let index = 0; index < chunks.length; index += 1) {
    const { error } = await supabase
      .from('iptv_streams')
      .insert(chunks[index]);

    if (error) {
      throw new Error(`Failed to sync stream batch ${index + 1}/${chunks.length}: ${error.message}`);
    }

    console.log(`Synced stream batch ${index + 1}/${chunks.length} (${chunks[index].length} rows).`);
  }

  console.log(`Synced ${rows.length} streams.`);
};

const main = async () => {
  const startedAt = Date.now();

  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY)) {
    throw new Error('Missing SUPABASE_URL and Supabase key environment variables.');
  }

  console.log('Fetching IPTV-org datasets...');
  const [channels, streams, logos, regions] = await Promise.all([
    fetchJson('Channels', ENDPOINTS.channels),
    fetchJson('Streams', ENDPOINTS.streams),
    fetchJson('Logos', ENDPOINTS.logos),
    fetchJson('Regions', ENDPOINTS.regions)
  ]);

  console.log(`Fetched ${channels.length} channels, ${streams.length} streams, ${logos.length} logos, ${regions.length} regions.`);

  const logoMap = buildLogoMap(logos);
  console.log(`Prepared logo map with ${logoMap.size} entries.`);

  await syncRegions(regions);
  const validChannelIds = await syncChannels(channels, logoMap);
  await wipeStreams();
  await syncStreams(streams, validChannelIds);

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`IPTV-org sync completed in ${elapsedSeconds}s.`);
};

main().catch((error) => {
  console.error('IPTV-org sync failed:', error);
  process.exit(1);
});
