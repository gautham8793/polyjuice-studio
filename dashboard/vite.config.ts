import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { apiPlugin } from "./server/api";
import { contentRoot } from "./server/paths";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig(({ mode }) => {
  // Optional: PEXELS_API_KEY in dashboard/.env.local enables Pexels search
  const env = loadEnv(mode, path.dirname(fileURLToPath(import.meta.url)), "");
  return {
    plugins: [react(), apiPlugin(ROOT, { PEXELS_API_KEY: env.PEXELS_API_KEY })],
    publicDir: false,
    resolve: { dedupe: ["react", "react-dom", "remotion"] },
    // PORT from the environment (default 3200); set here so the npm script needs no shell syntax (Windows)
    server: { port: Number(process.env.PORT) || 3200, fs: { allow: [ROOT, contentRoot(ROOT)] } },
  };
});
