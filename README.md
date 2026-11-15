# 📺 StreamFlow V4.5 — Enterprise IPTV & Streaming Platform

StreamFlow is a modern, high-performance IPTV player, live TV streaming, and Video on Demand (VOD) platform built with a high-speed unified architecture. It supports live channels, custom M3U/Xtream Codes playlists, electronic program guides (EPG), stream proxy geo-routing, real-time analytics, and an intuitive user interface for web, desktop, and mobile PWA.

Hosted on **Oracle Cloud Infrastructure (OCI)** with a native **MySQL** database engine and **Nginx** reverse proxy under a unified origin.

---

## 🚀 Key Features

- 🔑 **Flexible Authentication**: Full authentication system with Email/Password login, Sign Up validation, and **Instant Guest Login** with display names.
- 📡 **Multi-Source IPTV Engine**: Built-in support for global public IPTV sources (`iptv-org`), custom M3U playlists, Xtream Codes API, and raw M3U text pastes.
- 🌍 **Full 250+ Country & Regional Filters**: Asia (50+ countries including Pakistan, India, Bangladesh, UAE, Saudi Arabia) and global coverage with ISO standard mappings.
- 🎬 **Multi-Server Movie & Series Streaming**:
  - **VidLink (Fast HD)**: Ad-free, high-bitrate streaming with JWPlayer engine.
  - **AutoEmbed**: Clean, ultra-fast streaming.
  - **VidSrc**: Classic, reliable multi-mirror stream provider.
  - **Smashy / AnyEmbed**: Dual-audio / Multi-language support (including Hindi dubbed).
  - **MultiEmbed & 2Embed**: High-availability fallback servers.
  - **Anti-Ad Hijack Sandbox**: Custom iframe sandbox allowing Cloudflare verification tokens while strictly denying top-window redirect hijacking.
- 📺 **Advanced Video Player**:
  - HLS.js and MPEG-TS stream playback engines with native fallbacks.
  - Automatic stream URL resolver & failover alternate URL switching.
  - One-click launch in external players (VLC, MX Player).
  - Stream proxying for bypassing CORS and ISP restrictions.
- ⭐ **Personalization & History**: Real-time favorite channels, watchlist, and "Continue Watching" history persistence.
- ⚙️ **Admin Control Panel**:
  - Live system metrics, active stream status checks, and analytics charts.
  - Cascading Region & Country filters for all 250+ territories.
  - Automatic background stream health bot with admin notification bell.
- 📲 **Progressive Web App (PWA)**: Desktop & Mobile installable web application with offline service worker support.

---

## 🏗️ Architecture Overview

StreamFlow runs on an independent **Oracle Cloud VPS** with a reverse-proxy architecture uniting frontend static delivery and backend API execution under a single secure origin (`https://streamhubflow.qzz.io`).

```mermaid
graph TD
    Client[Web / Mobile PWA Client] -->|HTTPS / REST API| Nginx[Nginx Reverse Proxy :443]
    Nginx -->|Static Assets / SPA Routing| WebDist[/var/www/streamhub]
    Nginx -->|Reverse Proxy /api/| Express[Node.js Express Backend :7860]
    Express -->|Local Connection Pool :3306| MySQL[(MySQL Database - streamflow_db)]
    Express -->|Stream Proxy / Failover| IPTV[External IPTV / HLS Providers]
    Express -->|Bot Health Monitoring| Scrapers[Stream Health & Scraper Bot]
    Client -->|Direct / Proxied Playback| VideoEngine[HLS.js / MPEG-TS / Embed Engine]
```

### Core Architecture Components

1. **Frontend (`/web`)**:
   - **Framework**: React 18 + Vite + TypeScript
   - **Styling**: Tailwind CSS + Shadcn UI (Enterprise Dark Theme)
   - **State & Routing**: React Router v6 + Context API (Sidebar & Theme)
   - **Media Engine**: HLS.js + mpegts.js + Sandboxed Multi-Server Embeds
2. **Backend (`/backend`)**:
   - **Runtime**: Node.js + Express (ES Modules)
   - **Database**: Native **MySQL 8.0** (`mysql2/promise` connection pool with 25 connections)
   - **Data Layer**: Supabase-compatible drop-in query builder adapter (`db.from(...).select()`) with raw SQL support
   - **Security**: JWT authentication + Bcrypt password hashing
   - **Proxy Engine**: Axios streaming pipeline for HLS `.ts` segments & M3U playlists
3. **Infrastructure & Hosting**:
   - **Server**: Oracle Cloud VPS (Ubuntu 24.04 LTS)
   - **Web Server**: Nginx with HTTP/2 and gzip compression
   - **SSL/TLS**: Automated Let's Encrypt (Certbot) with auto-renewal
   - **CI/CD**: GitHub Actions workflows for zero-downtime frontend & backend deployments

---

## 📁 Repository Directory Structure

```text
streamhub/
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml    # CI/CD: Builds Vite bundle on runner & deploys to VPS
│       └── deploy-backend.yml     # CI/CD: Deploys Node backend & restarts services
│
├── web/                           # Frontend React (Vite) Web Application
│   ├── src/
│   │   ├── components/            # Reusable UI (AppHeader, ChannelCard, MoviePlayer, HLSPlayer)
│   │   ├── context/               # Sidebar & App Context Providers
│   │   ├── lib/                   # API Client, movieSources, utils, and helpers
│   │   ├── pages/                 # App Views (Auth, Dashboard, Setup, Settings, Admin)
│   │   ├── App.tsx                # Routing Configuration
│   │   └── main.tsx               # Entry point
│   ├── public/                    # Static Assets (Logos, Icons, Manifest)
│   └── package.json
│
├── backend/                       # Node.js Express REST API Backend
│   ├── config/                    # Database Pool (db.js) & Environment Config
│   ├── middleware/                # JWT Auth & Security Middleware
│   ├── routes/                    # API Route Handlers (auth, iptv, favorites, stream, admin)
│   ├── scrapers/                  # Stream health check & scraping services
│   ├── scripts/                   # ETL & Maintenance (migrateFromSupabaseToMysql.js, syncIptv.js)
│   ├── sql/                       # DDL Schemas (mysql_schema.sql, full_supabase_schema.sql)
│   ├── server.js                  # Express Server Entry Point
│   └── package.json
│
├── SITE_OVERVIEW.md               # Detailed page-by-page specification
└── README.md                      # Primary project documentation
```

---

## 🛠️ Local Development Setup

### Prerequisites

- **Node.js**: `v18.x` or higher
- **npm**: `v9.x` or higher
- **MySQL Server**: `v8.0` or higher (or Docker)

### 1. Database Setup

```bash
# In MySQL shell or terminal:
mysql -u root -p -e "CREATE DATABASE streamflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p streamflow_db < backend/sql/mysql_schema.sql
```

### 2. Environment Configuration

Create a `.env` file inside the `backend/` directory:

```env
PORT=7860
NODE_ENV=development

# MySQL Configuration
USE_MYSQL=true
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=streamflow_user
MYSQL_PASSWORD=StreamFlow@2026!
MYSQL_DATABASE=streamflow_db

# Auth & Security
JWT_SECRET=streamflow_development_secret_key_change_in_production
JWT_EXPIRE=30d

# Scraper & IPTV
ADMIN_EMAILS=admin@streamflow.live
SCRAPER_ENABLED=true
SCRAPER_INTERVAL_MS=900000
```

### 3. Start Backend & Frontend

```bash
# Start Backend API (Port 7860)
cd backend
npm install
npm run dev

# Start Frontend (Port 8080)
cd ../web
npm install
npm run dev
```

The frontend will launch at `http://localhost:8080`, proxying `/api` calls directly to `http://localhost:7860`.

---

## 🔄 Supabase to MySQL Migration

To migrate existing Supabase data directly into MySQL:

1. Ensure Supabase credentials and MySQL credentials are present in `backend/.env`.
2. Run the automated migration script:

```bash
cd backend
npm run db:migrate:mysql
```

The script will automatically create missing tables, normalize JSON types, and batch-insert all records with progress logging.

---

## 🔌 API Endpoints Reference

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new account.
- `POST /api/auth/login` — Authenticate and receive a JWT token.
- `POST /api/auth/guest` — Instant guest login with custom display name.
- `GET /api/auth/me` — Retrieve logged-in user profile.

### 📺 IPTV & Channels (`/api/iptv`)
- `GET /api/iptv/channels` — Filter channels by region, country code, category, or search query.
- `GET /api/iptv/regions` — Retrieve all 250+ country and region definitions.
- `GET /api/iptv/categories` — List available channel categories.
- `POST /api/iptv/credentials` — Store custom M3U / Xtream credentials.
- `GET /api/iptv/playlist` — Fetch aggregated M3U playlist file.

### ⭐ Favorites & History (`/api/favorites`)
- `GET /api/favorites` — Get user's saved favorite channels.
- `POST /api/favorites` — Add a channel to favorites.
- `DELETE /api/favorites/:channelUrl` — Remove a channel from favorites.
- `GET /api/favorites/recently-watched` — Get user watch history.
- `POST /api/favorites/recently-watched` — Log a watched stream.

### 🌐 Stream Proxy (`/api/stream`)
- `GET /api/stream/proxy?url=...` — Proxy live HLS streams to bypass CORS.
- `GET /api/stream/resolve?url=...` — Resolve redirect streams to direct playback links.

### 🛠️ Admin (`/api/admin`)
- `POST /api/admin/login` — Admin session authentication.
- `GET /api/admin/analytics/summary` — System and stream performance metrics.
- `GET /api/admin/channels` — Manage custom IPTV and embed channels.
- `POST /api/admin/streams/health-check` — Bulk health-check channel streams.

---

## 🚀 Production Deployment (Oracle Cloud)

The production stack is deployed on Oracle Cloud with continuous deployment via GitHub Actions:

- **Frontend CI/CD** (`deploy-frontend.yml`):
  1. Builds Vite bundle on GitHub runner (`ubuntu-latest`).
  2. Uploads compressed archive to Oracle VPS via SSH.
  3. Extracts to `/var/www/streamhub/` and reloads Nginx.
- **Backend CI/CD** (`deploy-backend.yml`):
  1. Pulls latest commit to `~/streamflow/backend`.
  2. Builds and starts production container/process.
  3. Verifies `/health` endpoint before completing.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
