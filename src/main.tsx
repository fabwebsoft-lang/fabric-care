import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "@/lib/pwa";

registerServiceWorker();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 60 * 1000,
    },
  },
});

// Touch optimization for mobile responsiveness
if (typeof window !== "undefined") {
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: true });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: true });
  document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: true });
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <trpc.Provider>
      <App />
    </trpc.Provider>
  </QueryClientProvider>
);
