import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

import { authComponent, createAuth } from "./auth";

const VALID_AGENTS = [
  "claude-code",
  "cursor",
  "windsurf",
  "opencode",
  "gemini-cli",
  "antigravity",
  "codex",
  "github-copilot",
  "amp",
  "goose",
  "kilo",
  "kiro-cli",
  "roo",
  "trae",
  "clawdbot",
  "droid",
  "unknown",
] as const;

type AgentPlatform = (typeof VALID_AGENTS)[number];

function isValidAgent(agent: string): agent is AgentPlatform {
  return VALID_AGENTS.includes(agent as AgentPlatform);
}

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/api/installs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (typeof body !== "object" || body === null) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { owner, repo, skill, agent } = body as Record<string, unknown>;

    if (
      typeof owner !== "string" ||
      typeof repo !== "string" ||
      typeof skill !== "string"
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: owner, repo, skill",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const agentPlatform: AgentPlatform =
      typeof agent === "string" && isValidAgent(agent) ? agent : "unknown";

    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedIdentifier = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await ctx.runMutation(
      api.installs.recordInstallByNamespace,
      {
        githubOwner: owner,
        githubRepo: repo,
        skillSlug: skill,
        agent: agentPlatform,
        hashedIdentifier,
      }
    );

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

http.route({
  path: "/api/installs",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    await Promise.resolve();
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

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
