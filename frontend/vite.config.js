import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development (npm run dev) the page runs on :5173 and forwards /api to the Python backend.
export default defineConfig({
  plugins: [react()],
  // Fixed file names, so a rebuild replaces the old files instead of piling up new ones.
  build: { rollupOptions: { output: { entryFileNames: "assets/app.js", chunkFileNames: "assets/[name].js", assetFileNames: "assets/app.[ext]" } } },
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
});
