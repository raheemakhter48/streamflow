import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { authAPI } from "@/lib/api";
import { Zap, Tv, Shield, Play, Heart, Grid3X3, Sparkles, Lock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

const stats = [
  { icon: Zap,    title: 'Ultra Fast',      desc: 'Low latency global servers' },
  { icon: Tv,     title: '1000+ Channels',  desc: 'Live TV & VOD library' },
  { icon: Shield, title: 'Secure',          desc: 'AES-256 encrypted streams' },
];

const features = [
  { icon: Play,       title: 'Smooth Playback',     desc: 'Adaptive bitrate switching ensures buffer-free viewing even on slower connections.' },
  { icon: Heart,      title: 'Smart Favorites',     desc: 'Sync your personal watchlist across all devices instantly with one click.' },
  { icon: Grid3X3,    title: 'Dynamic Categories',  desc: 'Browse through thousands of channels organized by genre, language, and region.' },
  { icon: Sparkles,   title: '4K Ultra HD',         desc: 'Crystal clear resolution for major sports events and blockbuster movies.' },
  { icon: Lock,       title: 'Advanced Security',   desc: 'Built-in VPN protection and secure login protocols keep your data safe.' },
  { icon: Smartphone, title: 'Multi-Device',        desc: 'Stream on your Smart TV, smartphone, tablet, or laptop simultaneously.' },
];

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    authAPI.getCurrentUser()
      .then((data) => setIsAuthenticated(data.success && !!data.user))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const destination = isAuthenticated ? '/dashboard' : '/auth';

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-20 lg:pb-0">
      <AppHeader />

      <main className="px-5 max-w-lg lg:max-w-5xl mx-auto">
        {/* Hero */}
        <section className="pt-8 pb-7">
          <h1 className="text-[2.6rem] font-black leading-[1.1] mb-3 tracking-tight">
            Ultra Fast{' '}
            <span className="text-[#00D7E5]">Streaming</span>
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Access 1000+ Channels Securely with our cutting-edge IPTV infrastructure.
            Experience zero lag, 4K resolution, and global connectivity.
          </p>
          <Link to={destination} className="block mb-3">
            <Button className="w-full h-12 bg-[#00D7E5] hover:bg-[#00b8c5] text-black font-bold rounded-xl text-[15px] shadow-[0_0_20px_rgba(0,215,229,0.25)]">
              Start Streaming &rsaquo;
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full h-12 bg-transparent border border-[#2a2a2a] text-white hover:bg-[#151515] hover:border-[#333] rounded-xl text-[15px] font-semibold"
          >
            View Pricing
          </Button>
        </section>

        {/* Stats */}
        <section className="flex flex-col lg:flex-row gap-3 mb-8">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-4 bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
              <div className="w-10 h-10 rounded-xl bg-[#0f2020] border border-[#1a3030] flex items-center justify-center shrink-0">
                <s.icon className="w-5 h-5 text-[#00D7E5]" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">{s.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Features */}
        <section className="mb-8">
          <h2 className="text-xl font-black text-white mb-1">Next-Gen Features</h2>
          <p className="text-gray-500 text-xs mb-5">Engineered for the ultimate cinematic vault experience.</p>
          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-4 bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
                <div className="w-10 h-10 rounded-xl bg-[#0f2020] border border-[#1a3030] flex items-center justify-center shrink-0 mt-0.5">
                  <f.icon className="w-5 h-5 text-[#00D7E5]" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm mb-0.5">{f.title}</p>
                  <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-6 text-center mb-4">
          <h2 className="text-xl font-black text-white mb-2">Ready to Start Streaming?</h2>
          <p className="text-gray-400 text-xs leading-relaxed mb-5">
            Join 50k+ users enjoying the future of television today.
          </p>
          <Link to={destination}>
            <Button
              variant="outline"
              className="h-11 px-8 bg-transparent border border-[#00D7E5] text-[#00D7E5] hover:bg-[#00D7E5]/10 rounded-xl font-bold"
            >
              Get Started Now
            </Button>
          </Link>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
