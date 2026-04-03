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
  { day: "2026-03-10", pages: 5, speed: 12.5 },
  { day: "2026-03-11", pages: 7, speed: 14.2 },
  { day: "2026-03-12", pages: 4, speed: 10.8 },
  { day: "2026-03-13", pages: 8, speed: 15.0 },
  { day: "2026-03-14", pages: 6, speed: 13.3 },
  { day: "2026-03-15", pages: 5, speed: 11.7 },
  { day: "2026-03-16", pages: 9, speed: 16.1 },
  { day: "2026-03-17", pages: 7, speed: 14.5 },
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

  it("envoie deux photos avec des URLs QuickChart quand il y a des donnees", async () => {
    vi.mocked(getDailySpeedData).mockResolvedValue(MOCK_DATA);
    const ctx = makeCtx();
    await graphHandler(ctx);
    expect(ctx.replyWithPhoto).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(ctx.replyWithPhoto).mock.calls;
    expect(calls[0][0] as string).toMatch(QUICKCHART_RE);
    expect(calls[1][0] as string).toMatch(QUICKCHART_RE);
  });

  it("la deuxieme photo est un graphique en barres (pages/jour)", async () => {
    vi.mocked(getDailySpeedData).mockResolvedValue(MOCK_DATA);
    const ctx = makeCtx();
    await graphHandler(ctx);
    const pagesUrl = vi.mocked(ctx.replyWithPhoto).mock.calls[1][0] as string;
    const cParam = new URL(pagesUrl).searchParams.get("c");
    const config = JSON.parse(cParam as string);
    expect(config.type).toBe("bar");
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

  it("remplit les gaps calendaires entre les jours avec sessions", async () => {
    // Data with a 2-day gap (03-12 and 03-13 missing)
    vi.mocked(getDailySpeedData).mockResolvedValue([
      { day: "2026-03-10", pages: 5, speed: 12.0 },
      { day: "2026-03-11", pages: 7, speed: 14.0 },
      { day: "2026-03-14", pages: 6, speed: 13.0 },
    ]);
    const ctx = makeCtx();
    await graphHandler(ctx);
    expect(ctx.replyWithPhoto).toHaveBeenCalledTimes(2);
    // Check speed chart (first photo)
    const speedUrl = vi.mocked(ctx.replyWithPhoto).mock.calls[0][0] as string;
    const speedCParam = new URL(speedUrl).searchParams.get("c");
    const speedConfig = JSON.parse(speedCParam as string);
    // Should have 5 labels (10, 11, 12, 13, 14) with nulls for gaps
    expect(speedConfig.data.labels).toHaveLength(5);
    expect(speedConfig.data.datasets[0].data).toEqual([12, 14, null, null, 13]);
    // Check pages chart (second photo)
    const pagesUrl = vi.mocked(ctx.replyWithPhoto).mock.calls[1][0] as string;
    const pagesCParam = new URL(pagesUrl).searchParams.get("c");
    const pagesConfig = JSON.parse(pagesCParam as string);
    expect(pagesConfig.data.labels).toHaveLength(5);
    expect(pagesConfig.data.datasets[0].data).toEqual([5, 7, null, null, 6]);
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
