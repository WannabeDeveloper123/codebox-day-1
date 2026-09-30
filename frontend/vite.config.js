import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Send /api requests to the Express backend, so the browser sees one origin
    proxy: { "/api": "http://localhost:3000" },
  },
});
