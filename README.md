# 📺 StreamFlow tv+ — All-in-One Live TV, Movies & IPTV Streaming Platform

**StreamFlow tv+** aik modern, fast aur feature-rich entertainment web aur mobile platform hai. Yeh users ko poori dunya ke **30,000+ Live TV channels**, latest **Movies**, **TV Series**, aur **Custom IPTV Playlists** bina kisi rukawat ke aik hi jagah dekhne ki sahulat deta hai.

---

## 🎯 Yeh Project Kya Karta Hai? (Core Functionality)

### 1. 🔑 Easy Access & Authentication
- **1-Click Guest Login:** User ko password yaad rakhne ki zaroorat nahi. Sirf apna naam likh kar **"Launch as Guest"** karein aur foran streaming shuru karein.
- **Registered Accounts:** Email aur password ke zariye account banayein taake aapke **Favorites**, **Watch History**, aur **IPTV Settings** hamesha save rahein.

---

### 2. 📡 Live TV Channels & Global Coverage
- **30,000+ International Channels:** Sports, News, Movies, Music, Kids, Documentary, aur Entertainment channels.
- **Cascading Region & Country Filter:**
  - Region select karein (Asia, Europe, Americas, Africa).
  - Phir direct country choose karein (e.g. **Asia ➔ Pakistan, India, Bangladesh, UAE, Saudi Arabia** wagera — 250+ countries supported).
- **Category Chips:** Sports, News, Cinema, Animation jaisi categories par aik click karke filter karein.
- **Live Search:** Kisi bhi channel ka naam likhte hi real-time results screen par aate hain.

---

### 3. 🎬 Movies & Web Series (VOD Hub)
- **Trending & Popular Catalogs:** TMDB ke sath connected hai jahan latest releases, top-rated movies, aur trending TV shows poster aur details ke sath miltay hain.
- **Multi-Server Streaming Switcher:** Video player ke upar direct server dropdown diya gaya hai:
  - **VidLink (Fast HD):** High-speed, clean JWPlayer bina annoying popups ke.
  - **AutoEmbed:** Fast aur lightweight streaming.
  - **VidSrc:** Classic reliable stream provider.
  - **Smashy / AnyEmbed:** Dual-Audio aur Hindi Dubbed audio tracks support karta hai.
  - **MultiEmbed & 2Embed:** High-availability backup mirrors.
- **TV Series Episode Selector:** Har series ke tamam Seasons aur Episodes alag alag buttons mein aate hain.
- **Anti-Ad Hijack Protection:** Video player mein smart sandbox security lagi hai jo popunder ads ko aapki website badalne (redirect/hijack karne) se rokti hai.

---

### 4. 📺 Powerful Video Player Engine
- **Multi-Format Playback:** HLS (`.m3u8`), MPEG-TS, aur direct MP4 streams ko auto-detect karke smoothly play karta hai.
- **Automatic Stream Failover:** Agar channel ka primary link down ho, to player khud-b-khud alternative working stream dhoond kar switch kar leta hai.
- **Stream Proxying:** Agar koi ISP ya mixed-content (HTTP/HTTPS) kisi channel ko block kare, to backend proxy stream ko bypass karke play karta hai.
- **External Player Support:** User 1-click se stream ko **VLC Media Player** ya **MX Player (Android)** mein open kar sakta hai.
- **Orientation & Fullscreen:** Mobile par play hote hi automatically landscape mode aur native fullscreen support.

---

### 5. 📂 Custom IPTV & Xtream Codes Integration
Agar user ke paas apna private IPTV subscription hai:
- **M3U Link:** Apna M3U playlist URL daal kar saare paid channels load karein.
- **Xtream Codes API:** Server URL, Username, aur Password enter karein.
- **Paste M3U Content:** Raw `.m3u` file ka text direct paste karein.
- **Smart Merge:** User ki personal playlist aur public channels bina duplicate hue aik sath dashboard par show hotay hain.

---

## 🛠️ Local Development Setup

---

### 7. 🛠️ Admin Control Panel & Stream Health Bot
Website owner ke liye aik powerful admin dashboard mojood hai:
- **Custom Channel Manager:** Naye Live TV channels add karein (direct stream URL ya iframe embed code ke zariye).
- **Automatic Health Bot:** Background bot lagataar streams ko check karta rehta hai. Agar koi channel offline ho jaye to admin ko notification bell mein alert deta hai.
- **System Metrics & Analytics:** Kitne users active hain, kon se channels sab se zyada dekhe ja rahe hain, aur streaming traffic graphs.

---

### 8. 📲 Installable App (PWA)
- **Install on Mobile & PC:** Yeh website Progressive Web App (PWA) hai. Mobile browser par **"Add to Home Screen"** ya **"Install App"** ka button aata hai, jisse yeh bina Play Store ke bilkul native app ki tarah install ho jati hai.
- **Offline Shell:** App instant open hoti hai kyunke core files phone mein cache rehti hain.

---

## 🧭 Page-by-Page Overview

| Page / Route | Kya Hota Hai? |
|---|---|
| **`/` (Home)** | Welcome landing page — Hero section, streaming highlights, aur direct "Start Watching" button. |
| **`/auth`** | Login, Register, aur 1-Click Guest Access. |
| **`/dashboard`** | Main application hub — Live TV channels, Movies, Series, Categories, Search, aur Continue Watching. |
| **`/player`** | Fullscreen Video Player — Quality settings, External player options, aur Audio controls. |
| **`/movie/:id`** | Movie details, trailer, overview, aur multi-server video player. |
| **`/series/:id`** | TV show details, Season dropdown, aur Episode browser. |
| **`/setup`** | Custom IPTV (M3U / Xtream Codes) credentials add karne ki jagah. |
| **`/settings`** | Player preferences (HLS.js, MPEG-TS, Native) aur Stream Proxy toggle. |
| **`/admin`** | Channel management, Broken stream scanner, aur Analytics metrics. |

---

## 📄 License

Distributed under the MIT License.
