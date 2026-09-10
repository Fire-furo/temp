import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api to the Node/Express backend during development so the
// frontend can call fetch("/api/...") directly without hardcoding a
// host/port -- this changes to a real base URL (env var) at deploy time.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5050",
        changeOrigin: true,
      },
    },
  },
});
