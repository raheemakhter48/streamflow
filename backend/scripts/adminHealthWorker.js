import 'dotenv/config';
import axios from 'axios';
import supabase from '../config/supabase.js';

const INTERVAL_MS = Number.parseInt(process.env.ADMIN_HEALTH_INTERVAL_MS || `${15 * 60 * 1000}`, 10);
const BATCH_SIZE = Number.parseInt(process.env.ADMIN_HEALTH_BATCH_SIZE || '50', 10);
const TIMEOUT_MS = Number.parseInt(process.env.ADMIN_HEALTH_TIMEOUT_MS || '8000', 10);

const checkStream = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT_MS,
      responseType: 'stream',
      headers: {
        Range: 'bytes=0-1024',
        'User-Agent': 'VLC/3.0.11'
      },
      validateStatus: () => true
    });

    response.data?.destroy?.();

    return {
      status: response.status >= 200 && response.status < 400 ? 'working' : 'broken',
      statusCode: response.status,
      error: response.status >= 200 && response.status < 400 ? null : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      status: 'broken',
      statusCode: null,
      error: error.message
    };
  }
};

const runOnce = async () => {
  const { data: channels, error } = await supabase
    .from('admin_channels')
    .select('id, name, stream_url, status')
    .not('stream_url', 'is', null)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (error) {
    throw new Error(`Failed to load admin channels: ${error.message}`);
  }

  for (const channel of channels || []) {
    const startedAt = Date.now();
    const result = await checkStream(channel.stream_url);

    await supabase
      .from('admin_channels')
      .update({
        status: result.status,
        last_checked_at: new Date().toISOString(),
        last_status_code: result.statusCode,
        last_error: result.error,
        updated_at: new Date().toISOString()
      })
      .eq('id', channel.id);

    if (channel.status !== result.status) {
      await supabase.from('admin_system_logs').insert({
        level: result.status === 'working' ? 'info' : 'warn',
        scope: 'health-worker',
        message: `${channel.name} marked ${result.status}`,
        details: {
          channelId: channel.id,
          statusCode: result.statusCode,
          error: result.error,
          durationMs: Date.now() - startedAt
        }
      });
    }
  }

  console.log(`Admin health worker checked ${(channels || []).length} channels.`);
};

const loop = async () => {
  while (true) {
    try {
      await runOnce();
    } catch (error) {
      console.error('Admin health worker failed:', error.message);
    }

    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
};

loop();
