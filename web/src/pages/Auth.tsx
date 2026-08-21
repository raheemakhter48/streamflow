import { useState, useEffect } from "react";
import { authAPI } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Shield, Zap, User, UserCheck, Sparkles } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email:    z.string().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
});

const Auth = () => {
  const navigate = useNavigate();
  const [tab, setTab]               = useState<'login' | 'signup' | 'guest'>('login');
  const [isLoading, setIsLoading]   = useState(false);
  const [loginEmail, setLoginEmail]     = useState("");
  const [loginPassword, setLoginPass]   = useState("");
  const [signupEmail, setSignupEmail]   = useState("");
  const [signupPassword, setSignupPass] = useState("");
  const [guestName, setGuestName]       = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const v = authSchema.safeParse({ email: loginEmail, password: loginPassword });
      if (!v.success) { toast.error(v.error.errors[0].message); return; }
      await authAPI.login(loginEmail, loginPassword);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const v = authSchema.safeParse({ email: signupEmail, password: signupPassword });
      if (!v.success) { toast.error(v.error.errors[0].message); return; }
      await authAPI.register(signupEmail, signupPassword);
      toast.success("Account created! Welcome to StreamFlow!");
      navigate("/dashboard");
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        toast.error("This email is already registered. Please login instead.");
      } else {
        toast.error(err.message || "Failed to create account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error("Please enter a name to continue as Guest");
      return;
    }
    setIsLoading(true);
    try {
      const data = await authAPI.guestLogin(guestName);
      toast.success(`Welcome, ${data.user?.name || guestName}!`);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to continue as Guest");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black text-white px-4 py-10">
      {/* 3D Poster Collage Wall Background */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        <img
          src="/apple_tv_hero_collage.jpg"
          alt="StreamFlow 3D Poster Wall"
          className="h-full w-full object-cover object-center scale-105"
        />
        {/* Dark Apple Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[5px]" />
      </div>

      {/* Brand Header */}
      <div className="relative z-10 flex flex-col items-center mb-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 group"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black font-black text-xl shadow-2xl transition-transform group-hover:scale-105">
            
          </div>
          <div className="flex flex-col text-left">
            <span className="text-2xl font-black tracking-tight text-white leading-none">
              StreamFlow
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
              tv+
            </span>
          </div>
        </button>
      </div>

      {/* Apple TV Frosted Glass Auth Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-[#1C1C1E]/80 backdrop-blur-2xl shadow-2xl flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-white/10 bg-black/30">
            {(['login', 'signup', 'guest'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-4 text-xs font-extrabold uppercase tracking-widest transition-all relative ${
                  tab === t ? 'text-white bg-white/10' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {t === 'login' ? 'Login' : t === 'signup' ? 'Sign Up' : 'Guest'}
                {tab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-lg" />
                )}
              </button>
            ))}
          </div>

          {/* Form Content */}
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-center">
            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white/60 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input
                      type="email"
                      placeholder="name@streamflow.tv"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="h-12 w-full rounded-full border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white placeholder-white/30 transition-all focus:outline-none focus:border-white/40 focus:bg-white/15"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white/60 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input
                      type="password"
                      placeholder="••••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPass(e.target.value)}
                      required
                      className="h-12 w-full rounded-full border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white placeholder-white/30 transition-all focus:outline-none focus:border-white/40 focus:bg-white/15"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-white/10 accent-white" />
                    <span className="text-xs text-white/60">Remember me</span>
                  </label>
                  <button type="button" className="text-xs text-white font-semibold hover:underline">
                    Forgot?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="apple-pill-btn mt-2 flex h-12 w-full items-center justify-center gap-2 text-sm font-extrabold shadow-2xl disabled:opacity-60"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
                </button>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                  <span className="relative bg-[#1C1C1E] px-3 text-[10px] uppercase tracking-widest text-white/40 font-bold">Or</span>
                </div>

                <button
                  type="button"
                  onClick={() => setTab('guest')}
                  className="apple-pill-btn-secondary flex h-12 w-full items-center justify-center gap-2 text-xs font-bold"
                >
                  <UserCheck className="w-4 h-4 text-white" />
                  Continue as 1-Click Guest
                </button>
              </form>
            ) : tab === 'signup' ? (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white/60 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input
                      type="email"
                      placeholder="name@streamflow.tv"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      className="h-12 w-full rounded-full border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white placeholder-white/30 transition-all focus:outline-none focus:border-white/40 focus:bg-white/15"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white/60 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input
                      type="password"
                      placeholder="••••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPass(e.target.value)}
                      required
                      className="h-12 w-full rounded-full border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white placeholder-white/30 transition-all focus:outline-none focus:border-white/40 focus:bg-white/15"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="apple-pill-btn mt-3 flex h-12 w-full items-center justify-center gap-2 text-sm font-extrabold shadow-2xl disabled:opacity-60"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleGuestLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white/60 mb-2">Guest Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input
                      type="text"
                      placeholder="Enter your name (e.g. Alex)"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                      className="h-12 w-full rounded-full border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white placeholder-white/30 transition-all focus:outline-none focus:border-white/40 focus:bg-white/15"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-xs text-white/70 flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>No password needed! Just enter your name to access live streams and movies immediately.</span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="apple-pill-btn mt-3 flex h-12 w-full items-center justify-center gap-2 text-sm font-extrabold shadow-2xl disabled:opacity-60"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Launch as Guest'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pt-8">
        <div className="flex items-center justify-center gap-5">
          <span className="flex items-center gap-1.5 text-white/40 text-[10px] font-bold uppercase tracking-widest">
            <Shield className="w-3 h-3 text-white/60" /> Encrypted Session
          </span>
          <span className="flex items-center gap-1.5 text-white/40 text-[10px] font-bold uppercase tracking-widest">
            <Zap className="w-3 h-3 text-white/60" /> Ultra Fast Stream
          </span>
        </div>
      </div>
    </div>
  );
};

export default Auth;
