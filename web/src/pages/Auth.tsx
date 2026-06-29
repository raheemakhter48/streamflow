import { useState } from "react";
import { authAPI } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Shield, Zap } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email:    z.string().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
});

const Auth = () => {
  const navigate = useNavigate();
  const [tab, setTab]               = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading]   = useState(false);
  const [loginEmail, setLoginEmail]     = useState("");
  const [loginPassword, setLoginPass]   = useState("");
  const [signupEmail, setSignupEmail]   = useState("");
  const [signupPassword, setSignupPass] = useState("");

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

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* Logo */}
      <div className="flex flex-col items-center pt-14 pb-8">
        <div className="w-16 h-16 rounded-2xl bg-[#0f2020] border border-[#1a3030] flex items-center justify-center mb-3">
          <img
            src="/logo.png"
            alt="StreamFlow"
            className="w-10 h-10 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">StreamFlow</span>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col px-5 max-w-md mx-auto w-full">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden flex-1 max-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-[#1e1e1e]">
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-colors relative ${
                  tab === t ? 'text-white' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {t === 'login' ? 'Login' : 'Sign Up'}
                {tab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00D7E5]" />
                )}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="p-5">
            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type="email"
                      placeholder="name@streamflow.tv"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="w-full h-12 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl pl-10 pr-4 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-[#00D7E5]/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type="password"
                      placeholder="••••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPass(e.target.value)}
                      required
                      className="w-full h-12 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl pl-10 pr-4 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-[#00D7E5]/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-[#333] bg-[#0f0f0f] accent-[#00D7E5]" />
                    <span className="text-xs text-gray-500">Remember me</span>
                  </label>
                  <button type="button" className="text-xs text-[#00D7E5] font-semibold hover:text-[#00b8c5] transition-colors">
                    Forgot?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-[#00D7E5] hover:bg-[#00b8c5] text-black font-bold rounded-xl text-[15px] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type="email"
                      placeholder="name@streamflow.tv"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      className="w-full h-12 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl pl-10 pr-4 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-[#00D7E5]/50 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type="password"
                      placeholder="••••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPass(e.target.value)}
                      required
                      className="w-full h-12 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl pl-10 pr-4 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-[#00D7E5]/50 transition-colors"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-[#00D7E5] hover:bg-[#00b8c5] text-black font-bold rounded-xl text-[15px] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 px-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700 mb-3">
          Powered by StreamFlow V4.0
        </p>
        <div className="flex items-center justify-center gap-4">
          <span className="flex items-center gap-1.5 text-gray-700 text-[10px] font-bold uppercase tracking-widest">
            <Shield className="w-3 h-3" /> Secure
          </span>
          <span className="flex items-center gap-1.5 text-gray-700 text-[10px] font-bold uppercase tracking-widest">
            <Zap className="w-3 h-3" /> Ultra Fast
          </span>
        </div>
      </div>
    </div>
  );
};

export default Auth;
