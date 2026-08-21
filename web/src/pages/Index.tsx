import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { authAPI } from "@/lib/api";
import { Zap, Tv, Shield, Play, Heart, Grid3X3, Sparkles, Lock, Smartphone, ChevronRight, Star } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import SEO from "@/components/SEO";

const stats = [
  { icon: Zap,    title: 'Ultra Fast Engine', desc: 'Low latency global HLS stream servers' },
  { icon: Tv,     title: '1,000+ Live Channels', desc: 'Global TV, sports, news & entertainment' },
  { icon: Shield, title: 'Encrypted & Secure', desc: 'AES-256 protected streams with guest access' },
];

const features = [
  { icon: Play,       title: 'Smooth 4K Playback', desc: 'Adaptive bitrate switching ensures buffer-free viewing even on slower connections.' },
  { icon: Heart,      title: 'Smart Favorites Sync', desc: 'Sync your personal watchlist across all your devices instantly with one click.' },
  { icon: Grid3X3,    title: 'Dynamic Regional Filters', desc: 'Browse through thousands of channels organized by country, language, and genre.' },
  { icon: Sparkles,   title: 'Cinema Quality Video', desc: 'Crystal clear resolution for major live sports events and blockbuster movies.' },
  { icon: Lock,       title: 'Instant Guest Access', desc: 'No complex signup required. Click once to launch your personal dashboard.' },
  { icon: Smartphone, title: 'Multi-Device PWA', desc: 'Stream on Smart TV, iPhone, Android, PC, or tablet seamlessly.' },
];

const HERO_MOVIES = [
  {
    title: "Oppenheimer",
    rating: "8.9",
    year: "2023",
    backdrop: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1600&auto=format&fit=crop",
    overview: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb."
  },
  {
    title: "Dune: Part Two",
    rating: "8.8",
    year: "2024",
    backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop",
    overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family."
  },
  {
    title: "Spider-Man: Across the Spider-Verse",
    rating: "8.7",
    year: "2023",
    backdrop: "https://images.unsplash.com/photo-1635863138275-d9b33299680b?q=80&w=1600&auto=format&fit=crop",
    overview: "Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its existence."
  }
];

const Index = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    authAPI.getCurrentUser()
      .then((data) => setIsAuthenticated(data.success && !!data.user))
      .catch(() => setIsAuthenticated(false));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_MOVIES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const destination = isAuthenticated ? '/dashboard' : '/dashboard?view=movie';
  const currentHero = HERO_MOVIES[heroIndex];

  return (
    <div className="enterprise-bg min-h-screen text-white pb-20 lg:pb-12">
      <SEO
        title="StreamFlow tv+ — IPTV Player & Movie Streaming Dashboard"
        description="Stream 1,000+ live TV channels, blockbuster movies, and series with ultra-fast playback, guest login, and PWA support."
        path="/"
      />
      <AppHeader />

      <main className="mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8 pt-6">
        {/* Apple TV+ 3D Perspective Poster Collage Hero Showcase */}
        <section className="relative mb-12 overflow-hidden rounded-[2.5rem] border border-white/15 bg-[#000000] shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
          <div className="relative aspect-[16/9] min-h-[460px] max-h-[600px] w-full overflow-hidden">
            {/* 3D Floating Poster Collage Wall Image */}
            <img
              src="/apple_tv_hero_collage.jpg"
              alt="StreamFlow 3D Poster Wall"
              className="h-full w-full object-cover object-center transition-transform duration-1000 ease-out scale-105"
            />

            {/* Apple Cinematic Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/70 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#000000]/95 via-[#000000]/60 to-transparent" />

            {/* Hero Content Details */}
            <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12 lg:p-16">
              <div className="max-w-3xl space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-4 py-1.5 border border-white/20 text-xs font-extrabold uppercase tracking-[0.2em] text-white">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    🍿 StreamFlow Featured
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 backdrop-blur-md px-3.5 py-1 border border-amber-400/30 text-xs font-extrabold text-amber-300">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {currentHero.rating} / 10
                  </div>
                  <div className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md px-3 py-1 border border-white/10 text-xs font-bold text-white/80">
                    {currentHero.year}
                  </div>
                </div>

                <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl drop-shadow-xl leading-none">
                  Unlimited Live TV & Movies. <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
                    Stream Anywhere, Instantly.
                  </span>
                </h1>

                <p className="line-clamp-2 text-sm sm:text-base font-medium text-white/80 max-w-2xl leading-relaxed">
                  {currentHero.overview}
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => navigate(destination)}
                    className="apple-pill-btn px-9 py-4 text-sm sm:text-base font-extrabold flex items-center gap-3 shadow-2xl hover:scale-105 transition-transform"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    Start Streaming Free
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/dashboard?view=movie')}
                    className="apple-pill-btn-secondary px-8 py-4 text-sm sm:text-base font-bold flex items-center gap-2"
                  >
                    Explore Catalog
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Indicator Dots */}
              <div className="absolute bottom-6 right-6 sm:bottom-12 sm:right-12 flex items-center gap-2">
                {HERO_MOVIES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setHeroIndex(i)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      i === heroIndex ? "w-8 bg-white" : "w-2.5 bg-white/40 hover:bg-white/70"
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stats Row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-4 glass-card p-6 border border-white/10 bg-[#1C1C1E]/70 backdrop-blur-xl">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-white">
                <s.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="font-extrabold text-white text-base">{s.title}</p>
                <p className="text-white/50 text-xs mt-1 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Features Grid */}
        <section className="mb-16">
          <div className="mb-8 text-center max-w-2xl mx-auto">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Next-Gen Architecture</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">Engineered For Pure Cinema</h2>
            <p className="text-white/60 text-sm mt-2">Zero ads, zero buffering, and ultra-fast 1-click guest login on all devices.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-6 border border-white/10 bg-[#1C1C1E]/60 backdrop-blur-xl transition-transform hover:scale-[1.02]">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white mb-4">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-white text-lg mb-1.5">{f.title}</h3>
                <p className="text-white/60 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Card */}
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/15 bg-gradient-to-br from-[#1C1C1E] via-[#121318] to-[#000000] p-10 sm:p-16 text-center mb-8 shadow-2xl">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1 text-xs font-extrabold text-white">
               StreamFlow Experience
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Ready To Start Streaming?</h2>
            <p className="text-white/70 text-sm sm:text-base leading-relaxed">
              Join thousands of daily streamers enjoying live TV channels & blockbuster movies with instant Guest Login.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate(destination)}
                className="apple-pill-btn px-10 py-4 text-base font-extrabold inline-flex items-center gap-2 shadow-2xl hover:scale-105 transition-transform"
              >
                Launch Dashboard Now
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
