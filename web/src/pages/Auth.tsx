import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authAPI } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tv, Loader2, Shield, Zap, ArrowRight, Play } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
});

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = authSchema.safeParse({ email: loginEmail, password: loginPassword });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setIsLoading(false);
        return;
      }

      await authAPI.login(loginEmail, loginPassword);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = authSchema.safeParse({ email: signupEmail, password: signupPassword });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setIsLoading(false);
        return;
      }

      await authAPI.register(signupEmail, signupPassword);
      toast.success("Account created! Welcome to StreamVault!");
      navigate("/dashboard");
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        toast.error("This email is already registered. Please login instead.");
      } else {
        toast.error(error.message || "Failed to create account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30 overflow-x-hidden font-sans">
      {/* Background Glows (Figma Style Reverted) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-cyan-500/5 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-cyan-600/5 rounded-full blur-[150px]"></div>
      </div>

      {/* Navigation Header (Figma Exact Reverted) */}
      <nav className="relative z-50 flex items-center justify-between gap-4 px-4 py-5 sm:px-8 lg:px-12 lg:py-8 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setShowAuth(false)}>
          <img src="/logo.png" alt="Streamflow" className="w-10 h-10 sm:w-12 sm:h-12 object-contain transition-transform group-hover:scale-105 shadow-neon" />
          <span className="text-lg sm:text-2xl font-black tracking-tighter text-white uppercase italic">Stream Vault</span>
        </div>
        
        {!showAuth && (
          <Button 
            onClick={() => setShowAuth(true)}
            className="bg-cyan-400 hover:bg-cyan-300 text-black font-black tracking-tight rounded-full px-5 py-4 sm:px-10 sm:py-6 text-sm sm:text-lg transition-all hover:scale-105 shadow-[0_0_20px_rgba(0,215,229,0.3)]"
          >
            Get Started
          </Button>
        )}
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 pt-8 sm:pt-14 lg:pt-20 pb-16 sm:pb-24 lg:pb-32">
        {!showAuth ? (
          <div className="flex flex-col items-center text-center">
            {/* Tagline from Figma */}
            <div className="mb-8 sm:mb-12 inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md max-w-full">
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-cyan-400">Zero Buffering • Ultra Fast • HLS Powered</span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-6 sm:mb-8 leading-[0.95] text-white">
              Stream Your IPTV <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600">
                Like Never Before
              </span>
            </h1>
            
            <p className="text-base sm:text-xl md:text-2xl text-gray-400 max-w-3xl mb-10 sm:mb-16 font-medium leading-relaxed">
              Experience lightning-fast streaming with zero buffering. Add your IPTV credentials and watch thousands of channels instantly.
            </p>

            {/* Main Button from Figma */}
            <Button 
              onClick={() => setShowAuth(true)}
              className="group h-14 sm:h-20 px-8 sm:px-16 rounded-[2rem] sm:rounded-[2.5rem] bg-cyan-400 hover:bg-cyan-300 text-black text-lg sm:text-2xl font-black tracking-tight transition-all hover:scale-105 shadow-[0_0_30px_rgba(0,215,229,0.4)] mb-16 sm:mb-32"
            >
              Start Streaming <ArrowRight className="ml-2 sm:ml-3 w-5 h-5 sm:w-8 sm:h-8 group-hover:translate-x-2 transition-transform" />
            </Button>

            {/* Feature Grid (Exact Figma Style Reverted) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 lg:gap-12 w-full max-w-6xl">
              {[
                { icon: Zap, title: "Ultra Fast", desc: "0ms Buffering" },
                { icon: Tv, title: "All Categories", desc: "1000+ Channels" },
                { icon: Shield, title: "Encrypted", desc: "Secure & Private" }
              ].map((feature, i) => (
                <div key={i} className="group p-6 sm:p-8 lg:p-12 rounded-3xl lg:rounded-[3rem] bg-white/[0.02] border border-white/[0.05] flex flex-col items-center justify-center backdrop-blur-3xl hover:bg-white/[0.04] hover:border-cyan-500/30 transition-all duration-500">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[2rem] bg-black/40 flex items-center justify-center mb-4 sm:mb-8 border border-white/5 shadow-neon group-hover:scale-110 transition-transform">
                    <feature.icon className="w-7 h-7 sm:w-10 sm:h-10 text-cyan-400" />
                  </div>
                  <h3 className="font-black tracking-tight text-xl sm:text-3xl text-white mb-2 italic uppercase">{feature.title}</h3>
                  <p className="text-gray-500 font-bold tracking-widest text-xs uppercase">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center py-6 sm:py-12 animate-in fade-in zoom-in-95 duration-500">
            <Card className="w-full max-w-md bg-white/[0.03] border-white/10 backdrop-blur-2xl rounded-3xl sm:rounded-[3rem] overflow-hidden shadow-2xl p-3 sm:p-4">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-3xl sm:text-4xl font-black tracking-tighter uppercase italic text-cyan-400">Enter Vault</CardTitle>
                <CardDescription className="text-gray-400 font-bold tracking-widest text-[10px] uppercase">Unlock your premium experience</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-10 bg-black/40 p-1 rounded-2xl h-14">
                    <TabsTrigger value="login" className="rounded-xl data-[state=active]:bg-cyan-500 data-[state=active]:text-black font-black uppercase text-xs tracking-widest">Login</TabsTrigger>
                    <TabsTrigger value="signup" className="rounded-xl data-[state=active]:bg-cyan-500 data-[state=active]:text-black font-black uppercase text-xs tracking-widest">Join</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-cyan-400 font-black tracking-[0.2em] text-[10px] uppercase ml-4">Credentials Email</Label>
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                          className="h-14 sm:h-16 bg-black/50 border-white/10 rounded-2xl sm:rounded-[1.5rem] px-5 sm:px-6 focus:border-cyan-500/50 transition-all text-base sm:text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-cyan-400 font-black tracking-[0.2em] text-[10px] uppercase ml-4">Access Key</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          className="h-14 sm:h-16 bg-black/50 border-white/10 rounded-2xl sm:rounded-[1.5rem] px-5 sm:px-6 focus:border-cyan-500/50 transition-all text-base sm:text-lg"
                        />
                      </div>
                      <Button type="submit" className="w-full h-14 sm:h-16 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-lg sm:text-xl tracking-tighter rounded-2xl sm:rounded-[1.5rem] transition-all hover:scale-[1.02] active:scale-95 shadow-neon mt-4" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "AUTHENTICATE"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-cyan-400 font-black tracking-[0.2em] text-[10px] uppercase ml-4">Corporate Email</Label>
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          required
                          className="h-14 sm:h-16 bg-black/50 border-white/10 rounded-2xl sm:rounded-[1.5rem] px-5 sm:px-6 focus:border-cyan-500/50 transition-all text-base sm:text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-cyan-400 font-black tracking-[0.2em] text-[10px] uppercase ml-4">Set Password</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          required
                          className="h-14 sm:h-16 bg-black/50 border-white/10 rounded-2xl sm:rounded-[1.5rem] px-5 sm:px-6 focus:border-cyan-500/50 transition-all text-base sm:text-lg"
                        />
                      </div>
                      <Button type="submit" className="w-full h-14 sm:h-16 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-lg sm:text-xl tracking-tighter rounded-2xl sm:rounded-[1.5rem] transition-all hover:scale-[1.02] active:scale-95 shadow-neon mt-4" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "CREATE ACCOUNT"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="mt-10 text-center">
                  <button 
                    onClick={() => setShowAuth(false)}
                    className="text-gray-600 hover:text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
                  >
                    Back to Terminal
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer Decoration */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-20"></div>
    </div>
  );
};

export default Auth;
