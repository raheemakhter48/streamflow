import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authAPI, iptvAPI } from "@/lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Tv, Loader2, ArrowLeft, FileText } from "lucide-react";
import { z } from "zod";

const credentialsSchema = z.object({
  m3u_url: z.string().url({ message: "Invalid URL format" }).max(500),
});

const usernamePasswordSchema = z.object({
  server_url: z.string().url({ message: "Invalid server URL" }).max(500),
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const Setup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [providerName, setProviderName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [epgUrl, setEpgUrl] = useState("");
  const [m3uContent, setM3uContent] = useState("");
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "m3u");

  useEffect(() => {
    checkAuth();
    loadExistingCredentials();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await authAPI.getCurrentUser();
      if (!data.success || !data.user) {
        navigate("/auth");
        return;
      }
      setUser(data.user);
    } catch (error) {
      navigate("/auth");
    }
  };

  const loadExistingCredentials = async () => {
    try {
      const data = await iptvAPI.getCredentials();
      
      if (data.success && data.data) {
        const credentials = data.data;
        setProviderName(credentials.providerName || "");
        setUsername(credentials.username || "");
        setPassword(""); // Don't show password
        setServerUrl(credentials.serverUrl || "");
        setM3uUrl(credentials.m3uUrl || "");
        setEpgUrl(credentials.epgUrl || "");
      }
    } catch (error) {
      console.error("Error loading credentials:", error);
    }
  };

  const generateM3UFromCredentials = (serverUrl: string, username: string, password: string): string => {
    try {
      // Clean the server URL
      let cleanUrl = serverUrl.trim();
      if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
        cleanUrl = `http://${cleanUrl}`;
      }
      
      const url = new URL(cleanUrl);
      
      // Common IPTV M3U URL patterns
      // Pattern 1: /get.php?username=...&password=...&type=m3u_plus (most common)
      if (url.pathname === "/" || url.pathname === "" || url.pathname.includes("get.php")) {
        url.pathname = "/get.php";
        url.search = ""; // Clear existing params
        url.searchParams.set("username", username);
        url.searchParams.set("password", password);
        url.searchParams.set("type", "m3u_plus");
        return url.toString();
      }
      
      // Pattern 2: /username/password/m3u_plus.m3u
      url.pathname = `/${username}/${password}/m3u_plus.m3u`;
      url.search = "";
      return url.toString();
    } catch (error) {
      // If URL parsing fails, use the most common pattern
      const baseUrl = serverUrl.trim().replace(/\/$/, "");
      const protocol = baseUrl.startsWith("http") ? "" : "http://";
      return `${protocol}${baseUrl}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus`;
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = usernamePasswordSchema.safeParse({
        server_url: serverUrl,
        username,
        password,
      });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setIsLoading(false);
        return;
      }

      // Generate M3U URL from credentials
      const generatedM3UUrl = generateM3UFromCredentials(serverUrl, username, password);
      
      toast.info("Saving credentials...");

      const data = await iptvAPI.saveCredentials({
        providerName: providerName || undefined,
        username,
        password,
        serverUrl,
        m3uUrl: generatedM3UUrl,
        epgUrl: epgUrl || undefined,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to save credentials");
      }

      toast.success("IPTV credentials saved successfully!");
      setTimeout(() => {
        navigate("/dashboard?view=live&category=M3U");
      }, 500);
    } catch (error: any) {
      toast.error(error.message || "Failed to save credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveM3U = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = credentialsSchema.safeParse({ m3u_url: m3uUrl });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setIsLoading(false);
        return;
      }

      const data = await iptvAPI.saveCredentials({
        providerName: providerName || undefined,
        m3uUrl,
        epgUrl: epgUrl || undefined,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to save credentials");
      }

      toast.success("IPTV credentials saved successfully!");
      setTimeout(() => {
        navigate("/dashboard");
      }, 500);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveM3UContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!m3uContent || m3uContent.trim().length === 0) {
        toast.error("Please paste your M3U playlist content");
        setIsLoading(false);
        return;
      }

      // Validate M3U format
      if (!m3uContent.includes("#EXTINF") && !m3uContent.includes("#EXTM3U")) {
        toast.error("Invalid M3U format. Please check your playlist content.");
        setIsLoading(false);
        return;
      }

      const data = await iptvAPI.saveCredentials({
        providerName: providerName || "Manual Upload",
        m3uContent,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to save playlist");
      }

      toast.success("M3U playlist saved successfully!");
      setTimeout(() => {
        navigate("/dashboard?view=live&category=M3U");
      }, 500);
    } catch (error: any) {
      toast.error(error.message || "Failed to save M3U content");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-72 h-72 bg-neon-cyan rounded-full filter blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-neon-blue rounded-full filter blur-[120px] animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="glass-card border-glass-border animate-scale-in">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Tv className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold">IPTV Setup</CardTitle>
            <CardDescription className="text-base">
              Add your IPTV credentials to start streaming
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="credentials">Username/Password</TabsTrigger>
                <TabsTrigger value="m3u">M3U URL</TabsTrigger>
                <TabsTrigger value="paste">Paste M3U</TabsTrigger>
              </TabsList>

              <TabsContent value="credentials">
                <form onSubmit={handleSaveCredentials} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider Name (Optional)</Label>
                    <Input
                      id="provider"
                      type="text"
                      placeholder="e.g., MyIPTV"
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      className="bg-secondary/50 border-glass-border"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="server_url">Server URL</Label>
                    <Input
                      id="server_url"
                      type="url"
                      placeholder="http://iptv-provider.com:8080"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      required
                      className="bg-secondary/50 border-glass-border"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your IPTV server URL (e.g., https://example.com:8080)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="bg-secondary/50 border-glass-border"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-secondary/50 border-glass-border"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="epg_url_xtream">EPG XMLTV URL (Optional - will auto-generate if empty)</Label>
                    <Input
                      id="epg_url_xtream"
                      type="url"
                      placeholder="https://example.com/epg.xml.gz"
                      value={epgUrl}
                      onChange={(e) => setEpgUrl(e.target.value)}
                      className="bg-secondary/50 border-glass-border"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      We'll automatically generate your M3U playlist URL from your credentials.
                    </p>
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Tv className="w-4 h-4 mr-2" />}
                    Save & Start Watching
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="m3u">
                <form onSubmit={handleSaveM3U} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider-m3u">Provider Name (Optional)</Label>
                    <Input
                      id="provider-m3u"
                      type="text"
                      placeholder="e.g., MyIPTV"
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      className="bg-secondary/50 border-glass-border"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="m3u_url">M3U Playlist URL</Label>
                    <Input
                      id="m3u_url"
                      type="url"
                      placeholder="https://example.com/playlist.m3u"
                      value={m3uUrl}
                      onChange={(e) => setM3uUrl(e.target.value)}
                      required
                      className="bg-secondary/50 border-glass-border"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="epg_url">EPG XMLTV URL (Optional)</Label>
                    <Input
                      id="epg_url"
                      type="url"
                      placeholder="https://example.com/epg.xml.gz"
                      value={epgUrl}
                      onChange={(e) => setEpgUrl(e.target.value)}
                      className="bg-secondary/50 border-glass-border"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Your M3U URL is the direct link to your IPTV playlist. It usually ends with .m3u or .m3u8
                    </p>
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Tv className="w-4 h-4 mr-2" />}
                    Save & Start Watching
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="paste">
                <form onSubmit={handleSaveM3UContent} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider-paste">Provider Name (Optional)</Label>
                    <Input
                      id="provider-paste"
                      type="text"
                      placeholder="e.g., MyIPTV"
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      className="bg-secondary/50"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="m3u-content">Paste M3U Playlist Content</Label>
                    <Textarea
                      id="m3u-content"
                      placeholder="Paste your M3U playlist content here..."
                      value={m3uContent}
                      onChange={(e) => setM3uContent(e.target.value)}
                      required
                      className="bg-secondary/50 min-h-[300px] font-mono text-sm"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      If automatic fetching fails due to CORS, you can manually copy and paste your M3U playlist content here.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Save Playlist
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Setup;
