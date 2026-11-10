import { ConvexReactClient } from "convex/react";

import { env } from "./env";

const convexUrl = env.VITE_CONVEX_URL ?? null;

/** Null in a build that ships without the registry: the Registry view then says so. */
export const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

/** Convex serves HTTP actions from `.convex.site`, queries from `.convex.cloud`. */
export function convexSiteUrl(): string | null {
  return convexUrl?.replace(".convex.cloud", ".convex.site") ?? null;
}
