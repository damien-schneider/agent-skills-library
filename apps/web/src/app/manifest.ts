import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agents Library - AI Agent Skills Repository",
    short_name: "Agents Library",
    description:
      "The centralized hub for AI agent capabilities. Discover, share, and manage high-quality markdown skills for intelligent agents.",
    start_url: "/",
    id: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    orientation: "portrait-primary",
    scope: "/",
    categories: ["productivity", "developer tools", "utilities"],
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      {
        src: "/favicon/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/favicon/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: "Add New Skill",
        short_name: "New Skill",
        description: "Create or import a new AI agent skill",
        url: "/skills/new",
      },
      {
        name: "My Library",
        short_name: "Library",
        description: "View your saved skills",
        url: "/dashboard",
      },
    ],
  };
}
