import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();

// When USE_MYSQL is true, route all queries to the local MySQL database pool!
const useMySQL = process.env.USE_MYSQL === 'true' || process.env.DATABASE_TYPE === 'mysql';

let client;
if (useMySQL) {
  client = db;
} else {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    'placeholder-key';

  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabase = client;
export default client;
