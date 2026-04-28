import { describe, expect, it, vi } from "vitest";
import { handleLoginRequest } from "../../src/mcp/auth/handlers";

const SECRET = "test-secret";

describe("handleLoginRequest", () => {
  it("creates a login session and returns the verify page", async () => {
    const env = {
      MCP_SESSION_HMAC_SECRET: SECRET,
      BOT_TOKEN: "fake",
      ALLOWED_USER_ID: "12345",
      OAUTH_KV: {
        put: vi.fn(async () => undefined),
        get: vi.fn(async () => null),
        delete: vi.fn(async () => undefined),
      } as unknown as KVNamespace,
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({ first: vi.fn(async () => null) })),
        })),
      } as unknown as D1Database,
      OAUTH_PROVIDER: {
        parseAuthRequest: vi.fn(async () => ({
          clientId: "c",
          redirectUri: "https://x",
          scope: ["mcp:read"],
          state: "s",
          responseType: "code",
        })),
        completeAuthorization: vi.fn(),
      },
    };
    global.fetch = vi.fn(
      async () => new Response(null, { status: 200 })
    ) as unknown as typeof fetch;
    const req = new Request("https://example/oauth/login/request", {
      method: "POST",
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    const r = await handleLoginRequest(req, env as never);
    expect(r.status).toBe(200);
    expect(env.OAUTH_KV.put).toHaveBeenCalled();
  });
});
