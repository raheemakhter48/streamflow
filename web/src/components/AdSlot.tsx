import { useEffect } from "react";

interface AdSlotProps {
  slot: string;
  label?: string;
  className?: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  responsive?: boolean;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID;

const AdSlot = ({
  slot,
  label = "Advertisement",
  className = "",
  format = "auto",
  responsive = true,
}: AdSlotProps) => {
  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !slot) return;

    try {
      if (!document.querySelector(`script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`)) {
        const script = document.createElement("script");
        script.async = true;
        script.crossOrigin = "anonymous";
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
        document.head.appendChild(script);
      }

      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (error) {
      console.warn("AdSense slot could not be loaded", error);
    }
  }, [slot]);

  if (!ADSENSE_CLIENT_ID || !slot) {
    return (
      <div className={`rounded-xl border border-dashed border-[#262626] bg-[#101010] p-4 text-center ${className}`}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-700">{label}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-700">{label}</p>
      <ins
        className="adsbygoogle block"
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
};

export default AdSlot;
