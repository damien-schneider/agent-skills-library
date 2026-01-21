import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Archived Skills",
  description: "Admin view for archived AI agent skills.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ArchivedLayout({ children }: { children: ReactNode }) {
  return children;
}
