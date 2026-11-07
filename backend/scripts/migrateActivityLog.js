// Quick migration script – run with: node scripts/migrateActivityLog.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
);

const sql = `
CREATE TABLE IF NOT EXISTS public.activity_log (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NULL,
    session_id   UUID NOT NULL,
    ip_address   INET,
    action_type  TEXT NOT NULL,
    method       TEXT NOT NULL,
    url          TEXT NOT NULL,
    referrer     TEXT,
    user_agent   TEXT,
    payload      JSONB,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user    ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_session ON public.activity_log(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_time    ON public.activity_log(created_at DESC);
`;

async function migrate() {
  console.log('🔄 Creating activity_log table...');
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error('❌ Migration via RPC failed:', error.message);
    console.log('');
    console.log('👉 Supabase Dashboard pe jaao aur SQL Editor mein ye SQL manually run karo:');
    console.log(sql);
    console.log("NOTIFY pgrst, 'reload schema';");
    process.exit(1);
  }
  console.log('✅ activity_log table created successfully!');
  process.exit(0);
}

migrate();
