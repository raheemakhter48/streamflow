import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// Create MySQL Connection Pool
export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'streamflow_user',
  password: process.env.MYSQL_PASSWORD || 'StreamFlow@2026!',
  database: process.env.MYSQL_DATABASE || 'streamflow_db',
  waitForConnections: true,
  connectionLimit: 25,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

/**
 * Execute a raw parameterized SQL query
 */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Supabase-compatible Query Builder for MySQL
 * Allows all existing backend routes (auth, iptv, favorites, admin) to
 * interact with MySQL using the familiar .from(table).select().eq()... API
 */
class MySQLQueryBuilder {
  constructor(table) {
    this.table = table;
    this.operation = 'select'; // 'select' | 'insert' | 'update' | 'delete'
    this.selectFields = '*';
    this.countMode = null;
    this.isHead = false;
    this.whereClauses = [];
    this.params = [];
    this.orderClause = '';
    this.limitVal = null;
    this.offsetVal = null;
    this.insertData = null;
    this.updateData = null;
    this.expectSingle = false;
    this.expectMaybeSingle = false;
  }

  select(fields = '*', options = {}) {
    this.operation = 'select';
    this.selectFields = fields || '*';
    if (options?.count) this.countMode = options.count;
    if (options?.head) this.isHead = true;
    return this;
  }

  insert(data) {
    this.operation = 'insert';
    this.insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  upsert(data, _options = {}) {
    this.operation = 'upsert';
    this.insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data) {
    this.operation = 'update';
    this.updateData = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  not(column, operator, value) {
    const colName = column.includes('.') ? column.split('.').pop() : column;
    if (operator === 'is' && value === null) {
      this.whereClauses.push(`\`${colName}\` IS NOT NULL`);
    } else if (operator === 'in' && Array.isArray(value)) {
      if (value.length > 0) {
        const placeholders = value.map(() => '?').join(', ');
        this.whereClauses.push(`\`${colName}\` NOT IN (${placeholders})`);
        this.params.push(...value);
      }
    } else if (operator === 'eq') {
      this.whereClauses.push(`\`${colName}\` != ?`);
      this.params.push(value);
    }
    return this;
  }

  eq(column, value) {
    if (value === null || value === undefined) {
      this.whereClauses.push(`\`${column}\` IS NULL`);
    } else {
      this.whereClauses.push(`\`${column}\` = ?`);
      this.params.push(value);
    }
    return this;
  }

  neq(column, value) {
    if (value === null || value === undefined) {
      this.whereClauses.push(`\`${column}\` IS NOT NULL`);
    } else {
      this.whereClauses.push(`\`${column}\` != ?`);
      this.params.push(value);
    }
    return this;
  }

  in(column, values) {
    if (!Array.isArray(values) || values.length === 0) {
      this.whereClauses.push('1 = 0'); // False condition
      return this;
    }
    const placeholders = values.map(() => '?').join(', ');
    this.whereClauses.push(`\`${column}\` IN (${placeholders})`);
    this.params.push(...values);
    return this;
  }

  is(column, value) {
    if (value === null) {
      this.whereClauses.push(`\`${column}\` IS NULL`);
    } else if (value === false) {
      this.whereClauses.push(`\`${column}\` IS FALSE`);
    } else if (value === true) {
      this.whereClauses.push(`\`${column}\` IS TRUE`);
    } else {
      this.whereClauses.push(`\`${column}\` IS ?`);
      this.params.push(value);
    }
    return this;
  }

  like(column, pattern) {
    this.whereClauses.push(`\`${column}\` LIKE ?`);
    this.params.push(pattern);
    return this;
  }

  ilike(column, pattern) {
    // In MySQL utf8mb4_unicode_ci, LIKE is already case-insensitive
    this.whereClauses.push(`LOWER(\`${column}\`) LIKE LOWER(?)`);
    this.params.push(pattern);
    return this;
  }

  contains(column, value) {
    // Used for JSON arrays (e.g. iptv_regions.countries)
    this.whereClauses.push(`JSON_CONTAINS(\`${column}\`, JSON_QUOTE(?))`);
    this.params.push(String(value));
    return this;
  }

  order(column, { ascending = true } = {}) {
    const dir = ascending ? 'ASC' : 'DESC';
    this.orderClause = `ORDER BY \`${column}\` ${dir}`;
    return this;
  }

  limit(n) {
    this.limitVal = Number(n);
    return this;
  }

  range(from, to) {
    const offset = Number(from);
    const limit = Number(to) - offset + 1;
    this.offsetVal = offset;
    this.limitVal = limit;
    return this;
  }

  single() {
    this.expectSingle = true;
    this.limitVal = 1;
    return this;
  }

  maybeSingle() {
    this.expectMaybeSingle = true;
    this.limitVal = 1;
    return this;
  }

  // Promise resolution (.then() allows `await supabase.from(...)`)
  async then(resolve, reject) {
    try {
      const result = await this.execute();
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
      else resolve({ data: null, error: err, count: null });
    }
  }

  async execute() {
    try {
      const whereSQL = this.whereClauses.length > 0
        ? `WHERE ${this.whereClauses.join(' AND ')}`
        : '';

      if (this.operation === 'select') {
        let totalCount = null;
        if (this.countMode) {
          const countSQL = `SELECT COUNT(*) as count FROM \`${this.table}\` ${whereSQL}`;
          const [countRows] = await pool.execute(countSQL, this.params);
          totalCount = countRows[0]?.count ?? 0;
          if (this.isHead) {
            return { data: [], error: null, count: totalCount };
          }
        }

        // Format selected fields
        let selectSQL = this.selectFields;
        if (selectSQL === '*') {
          selectSQL = '*';
        } else {
          // Wrap individual column names safely
          selectSQL = selectSQL.split(',').map(s => {
            const col = s.trim();
            return col.includes('(') || col.includes(' ') ? col : `\`${col}\``;
          }).join(', ');
        }

        let querySQL = `SELECT ${selectSQL} FROM \`${this.table}\` ${whereSQL}`;
        if (this.orderClause) querySQL += ` ${this.orderClause}`;
        if (this.limitVal !== null) {
          querySQL += ` LIMIT ${this.limitVal}`;
          if (this.offsetVal !== null) querySQL += ` OFFSET ${this.offsetVal}`;
        }

        const [rows] = await pool.execute(querySQL, this.params);

        // Normalize JSON fields
        const normalized = rows.map(row => {
          for (const key of Object.keys(row)) {
            if (typeof row[key] === 'string' && (row[key].startsWith('[') || row[key].startsWith('{'))) {
              try { row[key] = JSON.parse(row[key]); } catch { /* ignore */ }
            }
          }
          return row;
        });

        if (this.expectSingle) {
          if (normalized.length === 0) {
            return { data: null, error: new Error('Row not found'), count: totalCount };
          }
          return { data: normalized[0], error: null, count: totalCount };
        }

        if (this.expectMaybeSingle) {
          return { data: normalized[0] || null, error: null, count: totalCount };
        }

        return { data: normalized, error: null, count: totalCount };
      }

      if (this.operation === 'insert' || this.operation === 'upsert') {
        const results = [];
        for (const item of this.insertData) {
          const record = { ...item };
          // Auto-generate UUID for string IDs if missing
          if (!record.id && !['iptv_streams'].includes(this.table)) {
            record.id = uuidv4();
          }

          // Convert arrays / objects to JSON strings
          for (const [k, v] of Object.entries(record)) {
            if (v && typeof v === 'object' && !(v instanceof Date)) {
              record[k] = JSON.stringify(v);
            }
          }

          const cols = Object.keys(record);
          const placeholders = cols.map(() => '?').join(', ');
          const values = Object.values(record);

          let sql = `INSERT INTO \`${this.table}\` (\`${cols.join('`, `')}\`) VALUES (${placeholders})`;
          if (this.operation === 'upsert') {
            const updateCols = cols
              .filter(c => c !== 'id')
              .map(c => `\`${c}\` = VALUES(\`${c}\`)`)
              .join(', ');
            if (updateCols) {
              sql += ` ON DUPLICATE KEY UPDATE ${updateCols}`;
            }
          }
          const [res] = await pool.execute(sql, values);

          if (record.id) {
            results.push(record);
          } else if (res.insertId) {
            record.id = res.insertId;
            results.push(record);
          }
        }

        const data = this.expectSingle ? results[0] : results;
        return { data, error: null };
      }

      if (this.operation === 'update') {
        const updateCols = [];
        const updateVals = [];
        for (const [k, v] of Object.entries(this.updateData)) {
          updateCols.push(`\`${k}\` = ?`);
          if (v && typeof v === 'object' && !(v instanceof Date)) {
            updateVals.push(JSON.stringify(v));
          } else {
            updateVals.push(v);
          }
        }

        const updateSQL = `UPDATE \`${this.table}\` SET ${updateCols.join(', ')} ${whereSQL}`;
        await pool.execute(updateSQL, [...updateVals, ...this.params]);

        return { data: this.updateData, error: null };
      }

      if (this.operation === 'delete') {
        const deleteSQL = `DELETE FROM \`${this.table}\` ${whereSQL}`;
        await pool.execute(deleteSQL, this.params);
        return { data: null, error: null };
      }

      return { data: null, error: null };
    } catch (err) {
      console.error(`[MySQLQueryBuilder] Error in ${this.table} operation:`, err);
      return { data: null, error: err, count: null };
    }
  }
}

/**
 * Supabase-compatible client interface powered by MySQL
 */
export const db = {
  from: (table) => new MySQLQueryBuilder(table),
  rpc: async () => ({ data: null, error: new Error('RPC not supported on MySQL') }),
  query,
  pool,
  isMySQL: true,
};

export default db;
