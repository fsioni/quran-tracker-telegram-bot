import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetMyCommands = vi.fn().mockResolvedValue(true);

vi.mock("grammy", () => {
  return {
    Bot: class MockBot {
      api = { setMyCommands: mockSetMyCommands };
    },
    webhookCallback: vi.fn().mockReturnValue(() => new Response("ok")),
  };
});

vi.mock("../src/bot", () => ({
  createBot: vi.fn().mockReturnValue({}),
}));

vi.mock("../src/locales", () => ({
  getLocale: vi.fn().mockReturnValue({}),
  getBotCommands: vi
    .fn()
    .mockReturnValue([{ command: "start", description: "test" }]),
}));

vi.mock("../src/services/db/config", () => ({
  getConfig: vi.fn().mockResolvedValue(null),
}));

// The OAuthProvider uses `import { WorkerEntrypoint } from "cloudflare:workers"` which
// is unavailable in Node/Vitest. Mock the package so that OAuthProvider becomes a simple
// passthrough that forwards every fetch call to the `defaultHandler`, which is our
// mcpDefaultHandler. This keeps all /setup and webhook routing tests valid.
vi.mock("@cloudflare/workers-oauth-provider", () => ({
  OAuthProvider: class MockOAuthProvider {
    private defaultHandler: {
      fetch: (req: Request, env: unknown, ctx: unknown) => Promise<Response>;
    };

    constructor(opts: {
      defaultHandler: {
        fetch: (req: Request, env: unknown, ctx: unknown) => Promise<Response>;
      };
    }) {
      this.defaultHandler = opts.defaultHandler;
    }

    fetch(req: Request, env: unknown, ctx: unknown): Promise<Response> {
      return this.defaultHandler.fetch(req, env, ctx);
    }
  },
}));

// Mock the MCP server to avoid @modelcontextprotocol/sdk bringing in cloudflare-specific
// code paths during testing.
vi.mock("../src/mcp/server", () => ({
  mcpApiHandler: { fetch: async () => new Response("mcp", { status: 200 }) },
}));

// Mock auth handlers to avoid pulling in cloudflare:workers via the oauth provider indirectly.
vi.mock("../src/mcp/auth/handlers", () => ({
  handleAuthorize: async () => new Response("authorize"),
  handleLoginRequest: async () => new Response("login-request"),
  handleLoginVerify: async () => new Response("login-verify"),
}));

import handler from "../src/index";

const mockCtx = {} as ExecutionContext;

const mockEnv = {
  BOT_TOKEN: "TOKEN",
  DB: {} as D1Database,
  ALLOWED_USER_ID: "123",
  MCP_SESSION_HMAC_SECRET: "secret",
  OAUTH_KV: {} as KVNamespace,
};

describe("fetch handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /setup enregistre les commandes", async () => {
    const req = new Request("https://bot.example.com/setup", {
      method: "POST",
      headers: { Authorization: "Bearer TOKEN" },
    });
    const res = await handler.fetch(req, mockEnv, mockCtx);

    expect(mockSetMyCommands).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Commands registered");
  });

  it("POST /setup sans token retourne 401", async () => {
    const req = new Request("https://bot.example.com/setup", {
      method: "POST",
    });
    const res = await handler.fetch(req, mockEnv, mockCtx);

    expect(mockSetMyCommands).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it("POST /setup avec mauvais token retourne 401", async () => {
    const req = new Request("https://bot.example.com/setup", {
      method: "POST",
      headers: { Authorization: "Bearer WRONG" },
    });
    const res = await handler.fetch(req, mockEnv, mockCtx);

    expect(mockSetMyCommands).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it("GET /setup retourne 405", async () => {
    const req = new Request("https://bot.example.com/setup", { method: "GET" });
    const res = await handler.fetch(req, mockEnv, mockCtx);

    expect(mockSetMyCommands).not.toHaveBeenCalled();
    expect(res.status).toBe(405);
  });

  it("POST /setup retourne 502 si setMyCommands echoue", async () => {
    mockSetMyCommands.mockRejectedValueOnce(new Error("API error"));
    const req = new Request("https://bot.example.com/setup", {
      method: "POST",
      headers: { Authorization: "Bearer TOKEN" },
    });
    const res = await handler.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(502);
  });

  it("requete normale delegue a webhookCallback", async () => {
    const { webhookCallback } = await import("grammy");
    const req = new Request("https://bot.example.com/webhook", {
      method: "POST",
    });
    await handler.fetch(req, mockEnv, mockCtx);

    expect(mockSetMyCommands).not.toHaveBeenCalled();
    expect(webhookCallback).toHaveBeenCalled();
  });
});
