import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authAPI } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tv, Loader2, Shield, Zap, ArrowRight, Play, Globe, CheckCircle2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authAPI.login(loginEmail, loginPassword);
      toast.success("Welcome to the platform");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authAPI.register(signupEmail, signupPassword);
      toast.success("Account successfully created");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white/10 font-sans tracking-tight">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-blue-500/10 via-transparent to-transparent blur-[120px]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-50 contrast-150"></div>
      </div>

      {/* Enterprise Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${scrolled ? 'bg-black/80 backdrop-blur-xl border-white/10 py-4' : 'bg-transparent border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setShowAuth(false)}>
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center transition-transform group-hover:scale-105">
              <Tv className="w-6 h-6 text-black" />
            </div>
            <span className="text-xl font-bold tracking-tighter uppercase tracking-[0.2em]">Streamflow</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Solutions</a>
            <a href="#" className="hover:text-white transition-colors">Infrastructure</a>
            <a href="#" className="hover:text-white transition-colors">Enterprise</a>
            <a href="#" className="hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-4">
            {!showAuth && (
              <>
                <button onClick={() => setShowAuth(true)} className="text-sm font-medium hover:text-white transition-colors text-gray-400">Sign In</button>
                <Button 
                  onClick={() => setShowAuth(true)}
                  className="bg-white hover:bg-gray-200 text-black font-bold rounded-full px-6 h-10 text-sm transition-all"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Hero Section */}
      <main className="relative z-10 pt-44 pb-32">
        {!showAuth ? (
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex flex-col items-center text-center mb-24">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black tracking-[0.3em] uppercase text-blue-400 mb-8 animate-fade-in">
                <Globe className="w-3 h-3" /> Global Edge Infrastructure
              </div>
              
              <h1 className="text-7xl md:text-8xl font-bold tracking-tighter leading-[0.95] mb-8 animate-slide-up">
                Premium IPTV <br />
                <span className="text-gray-500">Reimagined.</span>
              </h1>
              
              <p className="text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed animate-fade-in delay-200">
                The next generation streaming platform for professionals. Enterprise-grade stability meets a minimalist user experience.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 animate-fade-in delay-300">
                <Button 
                  onClick={() => setShowAuth(true)}
                  className="h-14 px-10 rounded-full bg-white hover:bg-gray-200 text-black text-lg font-bold transition-all shadow-xl shadow-white/5"
                >
                  Deploy Vault <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button variant="outline" className="h-14 px-10 rounded-full border-white/10 hover:bg-white/5 text-lg font-bold">
                  View Demo
                </Button>
              </div>
            </div>

            {/* Enterprise Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                { icon: Zap, title: "Edge Acceleration", desc: "Global CDN nodes ensuring < 50ms latency anywhere in the world." },
                { icon: Shield, title: "AES-256 Security", desc: "End-to-end encrypted streams with hardware-level privacy protection." },
                { icon: CheckCircle2, title: "99.9% Uptime", desc: "Redundant cluster architecture designed for mission-critical viewing." }
              ].map((feature, i) => (
                <div key={i} className="group p-10 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-blue-500 transition-colors">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>

            {/* Trusted By Section */}
            <div className="mt-32 text-center opacity-40">
              <p className="text-[10px] font-bold tracking-[0.5em] uppercase text-gray-500 mb-8">Trusted by industry leaders</p>
              <div className="flex flex-wrap justify-center gap-12 md:gap-24 grayscale opacity-50">
                <div className="text-2xl font-black tracking-tighter">NETFLIX</div>
                <div className="text-2xl font-black tracking-tighter">DISNEY+</div>
                <div className="text-2xl font-black tracking-tighter">PRIME</div>
                <div className="text-2xl font-black tracking-tighter">HULU</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center py-12 px-6">
            <Card className="w-full max-w-md bg-[#0A0A0A] border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl p-4">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-3xl font-bold tracking-tight">Access Streamflow</CardTitle>
                <CardDescription className="text-gray-500">Professional grade credentials required</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-10 bg-white/5 p-1 rounded-full h-12">
                    <TabsTrigger value="login" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-black font-bold text-xs uppercase tracking-widest">Login</TabsTrigger>
                    <TabsTrigger value="signup" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-black font-bold text-xs uppercase tracking-widest">Register</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase ml-4">Corporate Email</Label>
                        <Input
                          type="email"
                          placeholder="name@company.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                          className="h-14 bg-white/5 border-white/5 rounded-full px-6 focus:border-white/20 transition-all placeholder:text-gray-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase ml-4">Access Token</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          className="h-14 bg-white/5 border-white/5 rounded-full px-6 focus:border-white/20 transition-all placeholder:text-gray-700"
                        />
                      </div>
                      <Button type="submit" className="w-full h-14 bg-white hover:bg-gray-200 text-black font-bold rounded-full transition-all text-sm uppercase tracking-widest mt-4" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authenticate"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase ml-4">Corporate Email</Label>
                        <Input
                          type="email"
                          placeholder="name@company.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          required
                          className="h-14 bg-white/5 border-white/5 rounded-full px-6 focus:border-white/20 transition-all placeholder:text-gray-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase ml-4">Set Password</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          required
                          className="h-14 bg-white/5 border-white/5 rounded-full px-6 focus:border-white/20 transition-all placeholder:text-gray-700"
                        />
                      </div>
                      <Button type="submit" className="w-full h-14 bg-white hover:bg-gray-200 text-black font-bold rounded-full transition-all text-sm uppercase tracking-widest mt-4" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="mt-8 text-center">
                  <button 
                    onClick={() => setShowAuth(false)}
                    className="text-gray-600 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    Back to portal
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Enterprise Footer */}
      <footer className="relative z-10 border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">
            © 2026 Streamflow Global Infrastructure Inc.
          </div>
          <div className="flex gap-8 text-[10px] font-bold tracking-widest text-gray-600 uppercase">
            <a href="#" className="hover:text-white">Privacy</a>
            <a href="#" className="hover:text-white">Security</a>
            <a href="#" className="hover:text-white">Compliance</a>
            <a href="#" className="hover:text-white">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Auth;
