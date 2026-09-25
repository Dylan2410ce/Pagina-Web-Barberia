import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import seoPlugin from "./config/seo-plugin.mjs";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), seoPlugin({ ...loadEnv(mode, process.cwd(), ""), ...process.env })],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
  },
}));
