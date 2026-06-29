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
      bottom: 20,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      background: "linear-gradient(135deg, #00D7E5, #00A8B5)",
      borderRadius: 16,
      padding: "14px 20px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      boxShadow: "0 8px 32px rgba(0,215,229,0.4)",
      width: "calc(100% - 40px)",
      maxWidth: 420,
    }}>
      <span style={{ fontSize: 26 }}>📲</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#000", fontWeight: 900, fontSize: 14 }}>Install StreamFlow</div>
        <div style={{ color: "rgba(0,0,0,0.7)", fontSize: 12 }}>Add to home screen for best experience</div>
      </div>
      <button
        onClick={handleInstall}
        style={{
          background: "#000",
          color: "#00D7E5",
          border: "none",
          borderRadius: 10,
          padding: "8px 16px",
          fontWeight: 900,
          fontSize: 13,
          cursor: "pointer",
        }}>
        Install
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(0,0,0,0.6)",
          fontSize: 20,
          cursor: "pointer",
          padding: 4,
        }}>
        ✕
      </button>
    </div>
  );
};

export default InstallBanner;
