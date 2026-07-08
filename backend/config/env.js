import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendEnvPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: backendEnvPath });

if (result.parsed) {
  Object.entries(result.parsed).forEach(([key, value]) => {
    if (!String(process.env[key] || '').trim()) {
      process.env[key] = value;
    }
  });
}
