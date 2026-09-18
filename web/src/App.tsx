import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Setup = lazy(() => import("./pages/Setup"));
const Player = lazy(() => import("./pages/Player"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const MovieDetails = lazy(() => import("./pages/MovieDetails"));
const SeriesDetails = lazy(() => import("./pages/SeriesDetails"));
const NotFound = lazy(() => import("./pages/NotFound"));
import InstallBanner from "./components/InstallBanner";
import { SidebarProvider } from "./context/SidebarContext";

const queryClient = new QueryClient();
const Router = import.meta.env.VITE_DESKTOP === "true" ? HashRouter : BrowserRouter;

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <InstallBanner />
        <SidebarProvider>
          <Router>
            <Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center bg-[#090909] text-white">Loading...</div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/player" element={<Player />} />
              <Route path="/movie/:id" element={<MovieDetails />} />
              <Route path="/series/:id" element={<SeriesDetails />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin" element={<Admin />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </Router>
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
