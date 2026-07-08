import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.VITE_API_URL || env.VITE_API_BASE_URL || "http://localhost:7860/api";
  const apiProxyTarget = apiBaseUrl.replace(/\/api\/?$/, "");

  return {
    base: env.VITE_DESKTOP === "true" ? "./" : "/",
    server: {
      port: 8080,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["logo.png"],
        manifest: {
          name: "StreamFlow - IPTV Player",
          short_name: "StreamFlow",
          description: "Ultra-fast IPTV streaming platform",
          theme_color: "#00D7E5",
          background_color: "#000000",
          display: "standalone",
          orientation: "landscape",
          start_url: "/",
          icons: [
            {
              src: "/logo.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/logo.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
