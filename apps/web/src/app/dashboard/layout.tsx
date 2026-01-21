import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My Library",
  description:
    "Manage your saved AI agent skills, import new skills, and organize your personal library of agent capabilities.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
