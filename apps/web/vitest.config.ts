import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    env: {
      NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
      NEXT_PUBLIC_CONVEX_SITE_URL: "https://test.convex.site",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3020",
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
