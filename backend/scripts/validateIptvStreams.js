import 'dotenv/config';
import axios from 'axios';
import https from 'https';
import supabase from '../config/supabase.js';

const FETCH_BATCH_SIZE = Number.parseInt(process.env.IPTV_VALIDATE_FETCH_BATCH || '1000', 10);
const UPDATE_BATCH_SIZE = Number.parseInt(process.env.IPTV_VALIDATE_UPDATE_BATCH || '100', 10);
const CONCURRENCY = Number.parseInt(process.env.IPTV_VALIDATE_CONCURRENCY || '25', 10);
const TIMEOUT_MS = Number.parseInt(process.env.IPTV_VALIDATE_TIMEOUT_MS || '8000', 10);
const LIMIT = Number.parseInt(process.env.IPTV_VALIDATE_LIMIT || '0', 10);
const UPDATE_RETRIES = Number.parseInt(process.env.IPTV_VALIDATE_UPDATE_RETRIES || '4', 10);

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const normalizeError = (error) => {
  const message = error?.message || 'Unknown validation error';
  return message.length > 250 ? `${message.slice(0, 247)}...` : message;
};

const isSuccessStatus = (status) => status >= 200 && status < 400;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const runWithRetry = async (operation, label) => {
  let lastError;

  for (let attempt = 1; attempt <= UPDATE_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === UPDATE_RETRIES) break;

      const waitMs = 500 * attempt * attempt;
      console.warn(`${label} failed on attempt ${attempt}/${UPDATE_RETRIES}: ${normalizeError(error)}. Retrying in ${waitMs}ms.`);
      await sleep(waitMs);
    }
  }

  throw lastError;
};

const validateStream = async (stream) => {
  const checkedAt = new Date().toISOString();

  try {
    const response = await axios.get(stream.url, {
      responseType: 'stream',
      timeout: TIMEOUT_MS,
      maxRedirects: 5,
      httpsAgent,
      headers: {
        Accept: '*/*',
        Range: 'bytes=0-1024',
        'User-Agent': 'VLC/3.0.11'
      },
      validateStatus: () => true
    });

    if (response.data?.destroy) {
      response.data.destroy();
    }

    return {
      id: stream.id,
      is_working: isSuccessStatus(response.status),
      last_checked_at: checkedAt,
      last_status_code: response.status,
      last_error: isSuccessStatus(response.status) ? null : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      id: stream.id,
      is_working: false,
      last_checked_at: checkedAt,
      last_status_code: error?.response?.status || null,
      last_error: normalizeError(error)
    };
  }
};

const runConcurrent = async (items, worker, concurrency) => {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

const updateValidationResults = async (results) => {
  const chunks = chunkArray(results, UPDATE_BATCH_SIZE);

  for (let index = 0; index < chunks.length; index += 1) {
    await runWithRetry(async () => {
      const updates = chunks[index].map((result) => {
        return supabase
          .from('iptv_streams')
          .update({
            is_working: result.is_working,
            last_checked_at: result.last_checked_at,
            last_status_code: result.last_status_code,
            last_error: result.last_error
          })
          .eq('id', result.id);
      });

      const responses = await Promise.all(updates);
      const failedResponse = responses.find((response) => response.error);

      if (failedResponse?.error) {
        throw new Error(failedResponse.error.message);
      }
    }, `Update batch ${index + 1}/${chunks.length}`);
  }
};

const fetchStreamsBatch = async (from, to) => {
  const { data, error } = await supabase
    .from('iptv_streams')
    .select('id, url')
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to fetch streams ${from}-${to}: ${error.message}`);
  }

  return data || [];
};

const main = async () => {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY)) {
    throw new Error('Missing SUPABASE_URL and Supabase key environment variables.');
  }

  const startedAt = Date.now();
  let offset = 0;
  let checked = 0;
  let working = 0;
  let failed = 0;

  console.log(`Starting IPTV stream validation with concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms.`);

  while (true) {
    if (LIMIT > 0 && checked >= LIMIT) break;

    const remaining = LIMIT > 0 ? LIMIT - checked : FETCH_BATCH_SIZE;
    const batchSize = Math.min(FETCH_BATCH_SIZE, remaining);
    const streams = await fetchStreamsBatch(offset, offset + batchSize - 1);

    if (streams.length === 0) break;

    const results = await runConcurrent(streams, validateStream, CONCURRENCY);
    await updateValidationResults(results);

    const batchWorking = results.filter((result) => result.is_working).length;
    const batchFailed = results.length - batchWorking;

    checked += results.length;
    working += batchWorking;
    failed += batchFailed;
    offset += streams.length;

    console.log(`Validated ${checked} streams. Working=${working}, Failed=${failed}.`);

    if (streams.length < batchSize) break;
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`Validation complete in ${elapsedSeconds}s. Checked=${checked}, Working=${working}, Failed=${failed}.`);
};

main().catch((error) => {
  console.error('IPTV validation failed:', error);
  process.exit(1);
});
