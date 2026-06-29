# StreamFlow / StreamVault — Site Overview

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home (Index) | Landing page — hero, features, CTA, footer |
| `/auth` | Auth | Login + Sign Up (tabs) |
| `/dashboard` | Dashboard | Main app — channels, filters, favorites, history |
| `/setup` | Setup | IPTV credentials setup |
| `/player` | Player | Video player screen |
| `/settings` | Settings | Player preferences + proxy toggle |
| `/admin` | Admin | Admin panel — stats, charts, channel management |
| `*` | 404 | Not found page |

---

## Page Details

### `/` — Home
- Navbar with logo + Login/Dashboard button
- Hero section — headline, subtitle, "Start Streaming" CTA
- Stats row — Ultra Fast / 1000+ Channels / Secure
- Features grid (6 cards) — Playback, Favorites, Categories, Streaming, Security, Mobile
- CTA section — "Ready to Start Streaming?"
- Footer

---

### `/auth` — Auth
- **Login tab** — Email + Password + Submit
- **Sign Up tab** — Email + Password + Submit
- Zod validation (email format, password min 6 chars)
- On success → redirects to `/dashboard`

---

### `/dashboard` — Dashboard (Main App)

#### Views / Tabs
| View | What it shows |
|---|---|
| `home` | Welcome screen — Live TV / Movies / Series / EPG Guide cards + Continue Watching |
| `live` | Live TV channels list |
| `movie` | Movies list |
| `series` | Series list |
| `epg` | EPG Guide (channel list with schedule) |

#### Filters
| Filter | Type | Options |
|---|---|---|
| **Search** | Text input | Search by channel name |
| **Region** | Dropdown | Asia, Europe, Americas, etc. (from backend API) |
| **Country** | Dropdown | Countries inside selected region |
| **Category** | Tab/chip list | All, M3U, + auto-generated from playlist (Sports, News, Kids, etc.) |
| **Page** | Pagination | 36 channels per page |

#### Filter Persistence
- Filters saved in `localStorage` key: `streamvault_dashboard_filters`
- URL params synced: `?view=live&region=ASIA&country=PK&category=Sports&search=geo&page=2`

#### Channel Sources
- **IPTV-org** — Public channels from backend API (filtered by region/country)
- **M3U** — User's own playlist from saved IPTV credentials

#### Features
- Continue Watching row (recently watched channels)
- Favorites toggle on each channel card
- Refresh button to reload channels
- Auto-merges IPTV-org + M3U channels (no duplicates by URL)
- Country auto-detection from channel name (PK, IN, etc.)

---

### `/setup` — Setup

#### Tabs
| Tab | Fields |
|---|---|
| **M3U URL** | Provider Name, M3U URL, EPG URL (optional) |
| **Xtream Codes** | Provider Name, Server URL, Username, Password, EPG URL |
| **Paste M3U** | Provider Name, M3U Content (textarea) |

- Loads existing credentials on open
- Zod validation on all fields
- On save → redirects to `/dashboard`

---

### `/player` — Player

- HLS video player (HLSPlayer component)
- Channel name in header
- Back button
- Favorite toggle (star icon)
- **More options dropdown:**
  - Open in VLC
  - Open in MX Player (Android)
  - Copy stream URL
  - Download stream
- Alternate URLs fallback (tries next URL if current fails)
- Auto adds to Recently Watched on open

---

### `/settings` — Settings

| Setting | Type | Options |
|---|---|---|
| **Stream Player Type** | Radio | Auto (Recommended) / HLS.js Only / MPEG-TS Only / Native Player |
| **Use Stream Proxy** | Toggle | On / Off |

- Saved in `localStorage`

---

### `/admin` — Admin Panel

#### Tabs
| Tab | Content |
|---|---|
| **Overview** | Stats cards — Users, Channels, Active Streams, Uptime. Line/Bar/Pie charts |
| **Channels** | Channel list table with filters, add/delete, import |
| **Users** | User list |
| **Logs** | Live terminal logs |
| **Settings** | System config |

- Charts: LineChart, BarChart, PieChart (Recharts)
- Requires admin auth (redirects if not admin)

---

## Components

| Component | Purpose |
|---|---|
| `ChannelCard` | Channel thumbnail card — logo, name, HD badge, favorite button |
| `CategoryFilter` | Horizontal scrollable category chips |
| `HLSPlayer` | Video player — HLS.js + MPEG-TS + Native fallback |
| `InstallBanner` | PWA install banner at bottom of screen |
| `NavLink` | Sidebar/nav link with active state |

---

## PWA (Install as App)
- `manifest.json` — name: StreamFlow, theme: #00D7E5, display: standalone
- Service Worker via `vite-plugin-pwa` (Workbox)
- `InstallBanner` component — shows install popup on mobile browsers
- "Add to Home Screen" also available via browser 3-dot menu

---

## API Endpoints Used (Frontend)

| Module | Endpoints |
|---|---|
| Auth | `/auth/login`, `/auth/register`, `/auth/logout`, `/auth/me` |
| IPTV | `/iptv/credentials`, `/iptv/playlist`, `/iptv/epg`, `/iptv/regions`, `/iptv/channels`, `/iptv/categories` |
| Favorites | `/favorites`, `/favorites/:url` |
| Recently Watched | `/favorites/recently-watched` |
| Stream | `/stream/proxy`, `/stream/resolve` |
| Admin | `/admin/stats`, `/admin/channels`, `/admin/users`, `/admin/logs` |

---

## Tech Stack (Web)

| Concern | Tool |
|---|---|
| Framework | React 18 + Vite + TypeScript |
| Routing | React Router v6 |
| UI | shadcn/ui + Tailwind CSS |
| Video | HLS.js + mpegts.js |
| Validation | Zod |
| PWA | vite-plugin-pwa (Workbox) |
| Deployment | Vercel (`streamhubflow.qzz.io`) |
