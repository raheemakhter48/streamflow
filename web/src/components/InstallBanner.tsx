import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallBanner = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) return null;
  if (!installEvent || dismissed) return null;

  const handleInstall = async () => {
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstallEvent(null);
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1C1C1E]/95 backdrop-blur-2xl border border-white/15 rounded-full px-5 py-2.5 flex items-center gap-3 shadow-2xl w-[calc(100%-32px)] max-w-md">
      <span style={{ fontSize: 22 }}></span>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#FFFFFF", fontWeight: 800, fontSize: 13 }}>Install StreamFlow tv+</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>Add to home screen for best experience</div>
      </div>
      <button
        onClick={handleInstall}
        style={{
          background: "#FFFFFF",
          color: "#000000",
          border: "none",
          borderRadius: 9999,
          padding: "7px 18px",
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
        }}>
        Install
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.6)",
          fontSize: 16,
          cursor: "pointer",
          padding: "4px 8px",
        }}>
        ✕
      </button>
    </div>
  );
};

export default InstallBanner;
