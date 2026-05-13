import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // base './' ensures assets use relative paths so Electron can load via file://
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
});
