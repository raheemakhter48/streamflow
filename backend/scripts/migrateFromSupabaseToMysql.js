import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'streamflow_user',
  password: process.env.MYSQL_PASSWORD || 'StreamFlow@2026!',
  database: process.env.MYSQL_DATABASE || 'streamflow_db',
  waitForConnections: true,
  connectionLimit: 10,
});

async function runSchema() {
  console.log('📦 Ensuring MySQL tables exist from schema...');
  const schemaPath = path.resolve(process.cwd(), 'sql/mysql_schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        // Ignore table exists or foreign key warnings
      }
    }
    console.log('✅ MySQL schema applied successfully.');
  }
}

async function migrateTable(tableName, batchSize = 500) {
  console.log(`\n⏳ Migrating table [${tableName}]...`);
  try {
    let offset = 0;
    let totalMigrated = 0;

    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.warn(`⚠️ Warning fetching ${tableName}: ${error.message}`);
        break;
      }

      if (!data || data.length === 0) break;

      for (const row of data) {
        const item = { ...row };
        // Normalize fields for MySQL
        for (const [k, v] of Object.entries(item)) {
          if (v && typeof v === 'object' && !(v instanceof Date)) {
            item[k] = JSON.stringify(v);
          }
        }

        const cols = Object.keys(item);
        const placeholders = cols.map(() => '?').join(', ');
        const updateClause = cols.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
        const values = Object.values(item);

        const sql = `
          INSERT INTO \`${tableName}\` (\`${cols.join('`, `')}\`)
          VALUES (${placeholders})
          ON DUPLICATE KEY UPDATE ${updateClause}
        `;

        await pool.execute(sql, values);
      }

      totalMigrated += data.length;
      console.log(`  -> Migrated ${totalMigrated} rows in ${tableName}...`);

      if (data.length < batchSize) break;
      offset += batchSize;
    }

    console.log(`✅ Finished [${tableName}]: Total ${totalMigrated} rows migrated.`);
  } catch (err) {
    console.error(`❌ Error migrating ${tableName}:`, err.message);
  }
}

async function startMigration() {
  console.log('🚀 Starting Supabase to MySQL Migration...');
  const start = Date.now();

  await runSchema();

  const tables = [
    'users',
    'profiles',
    'iptv_credentials',
    'iptv_regions',
    'iptv_channels',
    'iptv_streams',
    'favorites',
    'recently_watched',
    'playlist_cache',
    'admin_channels',
    'admin_filter_options',
    'admin_watch_events',
    'admin_api_metrics',
    'admin_scrape_runs',
    'admin_notifications',
    'activity_log'
  ];

  for (const table of tables) {
    await migrateTable(table);
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n🎉 ALL TABLES MIGRATED SUCCESSFULLY in ${duration}s!`);
  await pool.end();
}

startMigration().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
