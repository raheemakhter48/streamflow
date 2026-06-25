import 'dotenv/config'; // 🚀 MUST BE ON LINE 1: Loads variables before any other route or config imports
import express from 'express';
import cors from 'cors';
import supabase from './config/supabase.js';

// Routes import
import authRoutes from './routes/auth.js';
import iptvRoutes from './routes/iptv.js';
import favoritesRoutes from './routes/favorites.js';
import streamRoutes from './routes/stream.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 7860;

// Basic Middleware
app.use(cors());
app.use(express.json());

// Request Logger (Hugging Face logs mein nazar ayega)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// API metrics recorder — fire-and-forget, never blocks requests
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const startMs = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startMs;
    // Normalise UUID path segments so routes aggregate correctly
    const route = req.path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id');
    supabase.from('admin_api_metrics').insert({
      route,
      method: req.method,
      status_code: res.statusCode,
      duration_ms: duration
    }).then(() => {}).catch(() => {});
  });
  next();
});

// Health check (Isse pata chalega server zinda hai)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV || 'not set'
  });
});

// Root route (Hugging Face default page ke liye)
app.get('/', (req, res) => {
  res.send('StreamFlow API is Running! Use /health to check status.');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/iptv', iptvRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.url} not found on this server` });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';
  res.status(err.statusCode || 500).json({ success: false, message });
});

// Start server - 0.0.0.0 is MANDATORY for Hugging Face
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is listening on 0.0.0.0:${PORT}`);

  // Scraper cron is opt-in because Puppeteer is heavy and optional for manual IPTV management.
  if (process.env.SCRAPER_ENABLED === 'true') {
    import('./scripts/scrapeCron.js')
      .then(({ startScrapeCron }) => startScrapeCron())
      .catch((error) => {
        console.warn(`⚠️ Scraper cron disabled: ${error.message}`);
      });
  }
});

export default app;
