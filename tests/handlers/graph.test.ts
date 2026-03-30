// tests/handlers/graph.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomContext } from "../../src/bot";
import { graphHandler } from "../../src/handlers/graph";
import { fr } from "../../src/locales/fr";
import type { DailySpeedPoint } from "../../src/services/db";

vi.mock("../../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/db")>();
  return {
    ...actual,
    getTimezone: vi.fn(),
    getDailySpeedData: vi.fn(),
  };
});

import { getDailySpeedData, getTimezone } from "../../src/services/db";

function makeCtx(match = ""): CustomContext {
  return {
    match,
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithPhoto: vi.fn().mockResolvedValue(undefined),
    db: {} as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

const QUICKCHART_RE = /^https:\/\/quickchart\.io\/chart\?c=/;

const MOCK_DATA: DailySpeedPoint[] = [
  { day: "2026-03-10", speed: 12.5 },
  { day: "2026-03-11", speed: 14.2 },
  { day: "2026-03-12", speed: 10.8 },
  { day: "2026-03-13", speed: 15.0 },
  { day: "2026-03-14", speed: 13.3 },
  { day: "2026-03-15", speed: 11.7 },
  { day: "2026-03-16", speed: 16.1 },
  { day: "2026-03-17", speed: 14.5 },
];

describe("graphHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
  });

  it("envoie noData quand il n'y a pas de donnees", async () => {
    vi.mocked(getDailySpeedData).mockResolvedValue([]);
    const ctx = makeCtx();
    await graphHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(fr.graph.noData);
    expect(ctx.replyWithPhoto).not.toHaveBeenCalled();
  });

  it("envoie une photo avec l'URL QuickChart quand il y a des donnees", async () => {
    vi.mocked(getDailySpeedData).mockResolvedValue(MOCK_DATA);
    const ctx = makeCtx();
    await graphHandler(ctx);
    expect(ctx.replyWithPhoto).toHaveBeenCalledOnce();
    const url = vi.mocked(ctx.replyWithPhoto).mock.calls[0][0] as string;
    expect(url).toMatch(QUICKCHART_RE);
  });

  it("parse l'argument custom /graph 90", async () => {
    vi.mocked(getDailySpeedData).mockResolvedValue(MOCK_DATA);
    const ctx = makeCtx("90");
    await graphHandler(ctx);
    expect(getDailySpeedData).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      90
    );
  });

  it("utilise le defaut 30 pour un argument invalide", async () => {
    vi.mocked(getDailySpeedData).mockResolvedValue(MOCK_DATA);
    const ctx = makeCtx("abc");
    await graphHandler(ctx);
    expect(getDailySpeedData).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      30
    );
  });

  it("clamp a 7 minimum", async () => {
    vi.mocked(getDailySpeedData).mockResolvedValue(MOCK_DATA);
    const ctx = makeCtx("1");
    await graphHandler(ctx);
    expect(getDailySpeedData).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      7
    );
  });

  it("clamp a 180 maximum", async () => {
    vi.mocked(getDailySpeedData).mockResolvedValue(MOCK_DATA);
    const ctx = makeCtx("999");
    await graphHandler(ctx);
    expect(getDailySpeedData).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      180
    );
  });

  it("fallback texte si l'envoi de photo echoue", async () => {
    vi.mocked(getDailySpeedData).mockResolvedValue(MOCK_DATA);
    const ctx = makeCtx();
    vi.mocked(ctx.replyWithPhoto).mockRejectedValueOnce(
      new Error("Telegram error")
    );
    await graphHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(fr.graph.error);
  });
});
