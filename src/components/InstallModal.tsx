import { useState, useEffect } from "react";
import { Download, Share2, PlusSquare, X, Check, Smartphone } from "lucide-react";
import { isAppInstalled, isIOS, promptInstall, subscribeInstallState } from "@/lib/pwa";
import { toast } from "sonner";

export function usePWAInstall() {
  const [installed, setInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    setInstalled(isAppInstalled());
    const unsub = subscribeInstallState(() => {
      setInstalled(isAppInstalled());
    });
    return unsub;
  }, []);

  const handleInstallClick = async () => {
    if (installed) {
      toast.info("Fabric Care is already installed on your device.");
      return;
    }

    const res = await promptInstall();
    if (res === "accepted") {
      toast.success("Installation started!");
    } else if (res === "ios" || res === "unavailable") {
      setShowIOSGuide(true);
    }
  };

  return {
    installed,
    showIOSGuide,
    setShowIOSGuide,
    handleInstallClick,
  };
}

export function IOSInstallGuideModal({ onClose }: { onClose: () => void }) {
  const isApple = isIOS();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#0F4C5C]/40 px-4 py-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-32px)] w-full max-w-[400px] overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(17,17,17,.12)]"
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[#0F4C5C]/10 text-[#0F4C5C]" aria-hidden="true">
              <Download className="size-5" />
            </div>
            <div>
              <h3 id="ios-install-title" className="font-display text-[16px] font-bold text-[#0F4C5C]">Install Fabric Care</h3>
              <p className="text-[10px] text-slate-500">Fast home screen access & offline mode</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-[#0F4C5C] transition cursor-pointer"
            aria-label="Close installation guide"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs text-slate-700">
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
            <p className="font-semibold text-slate-800">
              {isApple ? "Install on iPhone / iPad (Safari):" : "Add to Home Screen:"}
            </p>
            <ol className="list-decimal pl-4 space-y-2 text-[11px] leading-relaxed text-slate-600">
              <li className="pl-1">
                Tap the <strong className="text-[#0F4C5C]">Share</strong> button{" "}
                <Share2 className="inline size-3.5 text-[#0F4C5C]" aria-hidden="true" /> in the browser bar.
              </li>
              <li className="pl-1">
                Scroll down the options and select{" "}
                <strong className="text-[#0F4C5C]">"Add to Home Screen"</strong>{" "}
                <PlusSquare className="inline size-3.5 text-[#0F4C5C]" aria-hidden="true" />.
              </li>
              <li className="pl-1">
                Tap <strong className="text-[#0F4C5C]">"Add"</strong> at the top right to complete.
              </li>
            </ol>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-600 bg-emerald-50 border border-emerald-200/60 p-2.5 rounded-xl">
            <Check className="size-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>Opens like a native app without browser bars and works seamlessly offline.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] mt-2 py-2.5 bg-[#0F4C5C] text-white text-xs font-bold rounded-xl hover:bg-[#0F4C5C]/90 focus-visible:ring-2 focus-visible:ring-[#0F4C5C] transition cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
