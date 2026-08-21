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

  if (!installEvent || dismissed) return null;

  const handleInstall = async () => {
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstallEvent(null);
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      background: "rgba(28, 28, 30, 0.92)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      borderRadius: 9999,
      padding: "10px 20px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
      width: "calc(100% - 40px)",
      maxWidth: 440,
    }}>
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
