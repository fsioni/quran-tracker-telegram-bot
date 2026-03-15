import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSetMyCommands = vi.fn().mockResolvedValue(true);

vi.mock("grammy", () => {
  return {
    Bot: class MockBot {
      api = { setMyCommands: mockSetMyCommands };
    },
    webhookCallback: vi.fn().mockReturnValue(
      () => new Response("ok"),
    ),
  };
});

vi.mock("../src/bot", () => ({
  createBot: vi.fn().mockReturnValue({}),
  BOT_COMMANDS: [{ command: "start", description: "test" }],
}));

import handler from "../src/index";

describe("fetch handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /setup enregistre les commandes", async () => {
    const req = new Request("https://bot.example.com/setup", {
      method: "POST",
      headers: { Authorization: "Bearer TOKEN" },
    });
    const res = await handler.fetch(req, { BOT_TOKEN: "TOKEN", DB: {} as D1Database, ALLOWED_USER_ID: "123" });

    expect(mockSetMyCommands).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Commands registered");
  });

  it("POST /setup sans token retourne 401", async () => {
    const req = new Request("https://bot.example.com/setup", { method: "POST" });
    const res = await handler.fetch(req, { BOT_TOKEN: "TOKEN", DB: {} as D1Database, ALLOWED_USER_ID: "123" });

    expect(mockSetMyCommands).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it("POST /setup avec mauvais token retourne 401", async () => {
    const req = new Request("https://bot.example.com/setup", {
      method: "POST",
      headers: { Authorization: "Bearer WRONG" },
    });
    const res = await handler.fetch(req, { BOT_TOKEN: "TOKEN", DB: {} as D1Database, ALLOWED_USER_ID: "123" });

    expect(mockSetMyCommands).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it("GET /setup retourne 405", async () => {
    const req = new Request("https://bot.example.com/setup", { method: "GET" });
    const res = await handler.fetch(req, { BOT_TOKEN: "TOKEN", DB: {} as D1Database, ALLOWED_USER_ID: "123" });

    expect(mockSetMyCommands).not.toHaveBeenCalled();
    expect(res.status).toBe(405);
  });

  it("POST /setup retourne 502 si setMyCommands echoue", async () => {
    mockSetMyCommands.mockRejectedValueOnce(new Error("API error"));
    const req = new Request("https://bot.example.com/setup", {
      method: "POST",
      headers: { Authorization: "Bearer TOKEN" },
    });
    const res = await handler.fetch(req, { BOT_TOKEN: "TOKEN", DB: {} as D1Database, ALLOWED_USER_ID: "123" });

    expect(res.status).toBe(502);
  });

  it("requete normale delegue a webhookCallback", async () => {
    const { webhookCallback } = await import("grammy");
    const req = new Request("https://bot.example.com/webhook", { method: "POST" });
    await handler.fetch(req, { BOT_TOKEN: "TOKEN", DB: {} as D1Database, ALLOWED_USER_ID: "123" });

    expect(mockSetMyCommands).not.toHaveBeenCalled();
    expect(webhookCallback).toHaveBeenCalled();
  });
});
