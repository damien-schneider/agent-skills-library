"use client";

import { usePathname } from "next/navigation";

const EXCLUDE_ROUTES = ["/skills/new"] as const;

export function ConditionalBackground() {
  const pathname = usePathname();

  if (EXCLUDE_ROUTES.includes(pathname as (typeof EXCLUDE_ROUTES)[number])) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0 bg-linear-to-b from-background via-background to-muted/20" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(99,102,241,0.03) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 h-full w-full bg-center bg-cover"
        style={{
          backgroundImage: "url('/shadow.png')",
          opacity: 0.08,
          maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
