import { env } from "@skills-agent-library/env/web";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSkillName(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const HASHED_IDENTIFIER_KEY = "hashed_identifier";

async function getHashedIdentifierFromServer(): Promise<string | null> {
  try {
    const convexUrl = env.NEXT_PUBLIC_CONVEX_URL;
    const response = await fetch(`${convexUrl}/hash-ip`);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { hashedIp: string };
    return data.hashedIp;
  } catch {
    return null;
  }
}

export async function getHashedIdentifier(): Promise<string | null> {
  // Check localStorage first
  if (globalThis.window !== undefined) {
    const stored = globalThis.window.localStorage.getItem(
      HASHED_IDENTIFIER_KEY
    );
    if (stored) {
      return stored;
    }

    // If not in localStorage, fetch from server and store it
    const hashedIp = await getHashedIdentifierFromServer();
    if (hashedIp) {
      globalThis.window.localStorage.setItem(HASHED_IDENTIFIER_KEY, hashedIp);
      return hashedIp;
    }
  }

  return null;
}
