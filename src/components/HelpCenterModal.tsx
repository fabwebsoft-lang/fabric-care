import { useEffect } from "react";
import { X, Globe, Phone, MessageSquare, Clock, ExternalLink } from "lucide-react";

interface HelpCenterModalProps {
  onClose: () => void;
}

export default function HelpCenterModal({ onClose }: HelpCenterModalProps) {
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
        aria-labelledby="help-center-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-32px)] w-full max-w-[440px] overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_24px_80px_rgba(17,17,17,.12)]"
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 id="help-center-title" className="font-display text-[20px] font-bold tracking-[-.03em] text-[#0F4C5C]">
              Help Center
            </h2>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">
              We are here to help you
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl bg-slate-100 text-[#0F4C5C] transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-[#0F4C5C] cursor-pointer"
            aria-label="Close Help Center"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Section: Contact Us */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#0F4C5C]">
                Contact Us
              </p>
              <p className="text-[12px] leading-relaxed text-slate-600 mt-1">
                Need help with the app, or want a similar app for your business? Contact our team.
              </p>
            </div>

            {/* Website */}
            <a
              href="https://mallist.online"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl bg-white border border-slate-200/90 p-3 text-slate-700 hover:border-[#0F4C5C]/40 hover:bg-[#0F4C5C]/5 transition group"
            >
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-[#0F4C5C]/10 text-[#0F4C5C]">
                  <Globe className="size-4" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Website</p>
                  <p className="text-[12px] font-bold text-[#0F4C5C]">mallist.online</p>
                </div>
              </div>
              <ExternalLink className="size-3.5 text-slate-400 group-hover:text-[#0F4C5C] transition-colors" />
            </a>

            {/* Phone 1 & WhatsApp 1 */}
            <div className="rounded-xl bg-white border border-slate-200/90 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-[#0F4C5C]/10 text-[#0F4C5C]">
                    <Phone className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Support Line 1</p>
                    <a
                      href="tel:+916379849947"
                      className="text-[12px] font-bold text-[#0F4C5C] hover:underline"
                    >
                      +91 63798 49947
                    </a>
                  </div>
                </div>
                <a
                  href="tel:+916379849947"
                  className="px-2.5 py-1 text-[11px] font-semibold text-[#0F4C5C] bg-[#0F4C5C]/10 rounded-lg hover:bg-[#0F4C5C]/20 transition"
                >
                  Call
                </a>
              </div>
              <a
                href="https://wa.me/916379849947"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-[11px] font-bold transition shadow-xs active:scale-98"
              >
                <MessageSquare className="size-3.5 fill-white" />
                Chat on WhatsApp (+91 63798 49947)
              </a>
            </div>

            {/* Phone 2 & WhatsApp 2 */}
            <div className="rounded-xl bg-white border border-slate-200/90 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-[#0F4C5C]/10 text-[#0F4C5C]">
                    <Phone className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Support Line 2</p>
                    <a
                      href="tel:+919025519125"
                      className="text-[12px] font-bold text-[#0F4C5C] hover:underline"
                    >
                      +91 90255 19125
                    </a>
                  </div>
                </div>
                <a
                  href="tel:+919025519125"
                  className="px-2.5 py-1 text-[11px] font-semibold text-[#0F4C5C] bg-[#0F4C5C]/10 rounded-lg hover:bg-[#0F4C5C]/20 transition"
                >
                  Call
                </a>
              </div>
              <a
                href="https://wa.me/919025519125"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-[11px] font-bold transition shadow-xs active:scale-98"
              >
                <MessageSquare className="size-3.5 fill-white" />
                Chat on WhatsApp (+91 90255 19125)
              </a>
            </div>
          </div>

          {/* Section: Support hours */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
              <Clock className="size-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Support hours
              </p>
              <p className="text-[12px] font-semibold text-slate-700">
                Monday to Saturday, 9:00 AM - 6:00 PM (IST)
              </p>
            </div>
          </div>

          {/* Section: Powered by */}
          <div className="pt-2 text-center border-t border-slate-100">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              Powered by
            </p>
            <a
              href="https://mallist.online"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#0F4C5C] hover:underline"
            >
              Mallist - mallist.online
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
