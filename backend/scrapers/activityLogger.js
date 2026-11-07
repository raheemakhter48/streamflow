// Activity logger middleware for StreamHub
// Captures every request (including guests) into the activity_log table.
// Uses BATCH inserts (not per-request) so the site stays fast.
// Uses Supabase (same as the rest of the project) – no extra 'pg' dependency.

import supabase from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

// ----------- Batch logging to avoid per‑request DB round‑trip -----------
const LOG_BATCH_SIZE = 100;
const LOG_FLUSH_INTERVAL_MS = 5000;
let logBuffer = [];
let flushTimer = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flushBuffer, LOG_FLUSH_INTERVAL_MS);
}

let activityLogTableMissing = false;

async function flushBuffer() {
  clearTimeout(flushTimer);
  flushTimer = null;
  const batch = logBuffer.splice(0, LOG_BATCH_SIZE);
  if (batch.length === 0) return;

  // Agar table Supabase mein abhi create nahi hua, toh repeatedly crash/spam na kare
  if (activityLogTableMissing) {
    // admin_system_logs (jo already exist karta hai) mein summary bhej dein
    return;
  }

  try {
    const { error } = await supabase.from('activity_log').insert(batch);
    if (error) {
      if (error.code === '42P01' || error.message?.includes('schema cache')) {
        activityLogTableMissing = true;
        console.warn('⚠️ activity_log table Supabase mein maujood nahi hai. Console spam roknay ke liye inserts pause kiye gaye hain.');
        return;
      }
      throw error;
    }
  } catch (e) {
    console.error('⚠️ Bulk activity logging failed:', e.message || e);
  }
}

/**
 * Ensure each incoming request has a stable session identifier.
 */
export function ensureSessionId(req, res, next) {
  if (!req.session?.id) {
    req.session = { id: uuidv4() };
  }
  next();
}

/**
 * Main activity‑logging middleware.
 * Non‑blocking: pushes log into buffer, batch flush handles DB write.
 */
export function activityLogger(req, res, next) {
  const { method, originalUrl, ip, headers, body, query, session, user } = req;

  logBuffer.push({
    user_id:     user?.id ?? null,
    session_id:  session.id,
    ip_address:  ip,
    action_type: `${method} ${originalUrl}`,
    method,
    url:         `${req.protocol}://${req.get('host')}${originalUrl}`,
    referrer:    headers.referer || null,
    user_agent:  headers['user-agent'] || null,
    payload:     { query, ...(method !== 'GET' && { body }) },
  });

  if (logBuffer.length >= LOG_BATCH_SIZE) {
    flushBuffer();
  } else {
    scheduleFlush();
  }

  next();
}

// Export flushBuffer for graceful shutdown in server.js
export { flushBuffer };
