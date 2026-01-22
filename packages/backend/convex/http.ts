import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// Endpoint to get hashed IP for unauthenticated users
http.route({
  path: "/hash-ip",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    // Get IP from headers (check common proxy headers)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

    // Hash the IP using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedIp = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return new Response(JSON.stringify({ hashedIp }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }),
});

export default http;
