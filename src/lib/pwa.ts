import { toast } from "sonner";

// PWA Deferred Prompt Event Type
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore
    }
  });
}

/**
 * Checks if the app is currently running in standalone (installed) mode.
 */
export function isAppInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://");
  return Boolean(isStandalone);
}

/**
 * Checks if current device is iOS (iPhone/iPad/iPod).
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Returns true if install prompt is ready or if on iOS (and not already installed).
 */
export function canInstall(): boolean {
  if (isAppInstalled()) return false;
  return Boolean(deferredPrompt) || isIOS();
}

/**
 * Returns the raw deferredPrompt if available.
 */
export function getDeferredPrompt() {
  return deferredPrompt;
}

/**
 * Subscribe to install availability changes.
 */
export function subscribeInstallState(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Triggers native installation prompt if available, or returns status.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "ios" | "unavailable"> {
  if (isAppInstalled()) return "unavailable";

  if (deferredPrompt) {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      notifyListeners();
      return choice.outcome;
    } catch (e) {
      console.warn("PWA prompt error:", e);
      return "unavailable";
    }
  }

  if (isIOS()) {
    return "ios";
  }

  return "unavailable";
}

/**
 * Registers the Service Worker and sets up update listeners.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // Listen for beforeinstallprompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyListeners();
    toast.success("Fabric Care installed!", {
      description: "You can now open Fabric Care directly from your home screen.",
    });
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates on page load and interval
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                showUpdateToast(reg);
              }
            });
          }
        });

        // Periodic background update check every 30 minutes
        setInterval(() => {
          reg.update().catch(() => {});
        }, 30 * 60 * 1000);
      })
      .catch((err) => {
        console.warn("SW registration skipped or failed:", err);
      });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

function showUpdateToast(registration: ServiceWorkerRegistration) {
  toast("New version available", {
    description: "An updated version of Fabric Care is ready.",
    duration: 10000,
    action: {
      label: "Refresh",
      onClick: () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        } else {
          window.location.reload();
        }
      },
    },
  });
}
