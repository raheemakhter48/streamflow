import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Expose Hls globally for media engine detection (Wappalyzer & debugging)
import("hls.js").then(({ default: Hls }) => {
  if (typeof window !== "undefined") {
    (window as any).Hls = Hls;
  }
}).catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
