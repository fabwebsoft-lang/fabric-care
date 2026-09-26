import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssMinify: true,
    minify: "esbuild",
    target: "es2020",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react/") || id.includes("react-dom/") || id.includes("wouter")) {
              return "vendor-react";
            }
            if (id.includes("@trpc/") || id.includes("@tanstack/react-query")) {
              return "vendor-trpc";
            }
            if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) {
              return "vendor-charts";
            }
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            if (id.includes("@radix-ui/")) {
              return "vendor-radix";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("date-fns")) {
              return "vendor-date";
            }
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      "/trpc": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/status": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
