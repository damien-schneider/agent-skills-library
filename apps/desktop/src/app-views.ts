import {
  Copy,
  History,
  LibraryBig,
  type LucideIcon,
  RefreshCw,
  Store,
} from "lucide-react";

export const VIEW_IDS = [
  "library",
  "prompts",
  "duplicates",
  "sync",
  "registry",
  "settings",
] as const;

export type ViewId = (typeof VIEW_IDS)[number];

/** Settings is reached from the sidebar footer, so it is not listed with the work views. */
export const PRIMARY_VIEWS: readonly {
  id: Exclude<ViewId, "settings">;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "library", label: "Library", icon: LibraryBig },
  { id: "prompts", label: "Prompts", icon: History },
  { id: "duplicates", label: "Duplicates", icon: Copy },
  { id: "sync", label: "Sync", icon: RefreshCw },
  { id: "registry", label: "Registry", icon: Store },
];
