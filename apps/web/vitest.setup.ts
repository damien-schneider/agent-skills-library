import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock the env package before any modules are loaded
vi.mock("@skills-agent-library/env/web", () => ({
  env: {
    NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
    NEXT_PUBLIC_CONVEX_SITE_URL: "https://test.convex.site",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3020",
  },
}));
