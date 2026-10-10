import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 8080,
    strictPort: false,
    allowedHosts: true,
    // In dev, same-origin /api keeps auth + CORS trivial; the Worker runs via
    // `npm run worker:dev` (wrangler dev on :8787). In production the SPA is
    // static on Vercel and VITE_API_URL points at the Worker directly.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/media": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/sitemap.xml": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          animation: ["framer-motion"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
