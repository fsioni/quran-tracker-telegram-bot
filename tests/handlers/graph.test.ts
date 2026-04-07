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
  { day: "2026-03-10", speed: 12.5, pages: 5 },
  { day: "2026-03-11", speed: 14.2, pages: 7 },
  { day: "2026-03-12", speed: 10.8, pages: 4 },
  { day: "2026-03-13", speed: 15.0, pages: 8 },
  { day: "2026-03-14", speed: 13.3, pages: 6 },
  { day: "2026-03-15", speed: 11.7, pages: 3 },
  { day: "2026-03-16", speed: 16.1, pages: 9 },
  { day: "2026-03-17", speed: 14.5, pages: 6 },
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

  it("envoie 2 photos avec l'URL QuickChart quand il y a des donnees", async () => {
    vi.mocked(getDailySpeedData).mockResolvedValue(MOCK_DATA);
    const ctx = makeCtx();
    await graphHandler(ctx);
    expect(ctx.replyWithPhoto).toHaveBeenCalledTimes(2);
    const speedUrl = vi.mocked(ctx.replyWithPhoto).mock.calls[0][0] as string;
    expect(speedUrl).toMatch(QUICKCHART_RE);
    const pagesUrl = vi.mocked(ctx.replyWithPhoto).mock.calls[1][0] as string;
    expect(pagesUrl).toMatch(QUICKCHART_RE);
  });

  it("le 2e appel contient un bar chart pour les pages", async () => {
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
      { day: "2026-03-10", speed: 12.0, pages: 5 },
      { day: "2026-03-11", speed: 14.0, pages: 7 },
      { day: "2026-03-14", speed: 13.0, pages: 6 },
    ]);
    const ctx = makeCtx();
    await graphHandler(ctx);
    expect(ctx.replyWithPhoto).toHaveBeenCalledTimes(2);
    const url = vi.mocked(ctx.replyWithPhoto).mock.calls[0][0] as string;
    const cParam = new URL(url).searchParams.get("c");
    const config = JSON.parse(cParam as string);
    // Should have 5 labels (10, 11, 12, 13, 14) with nulls for gaps
    expect(config.data.labels).toHaveLength(5);
    expect(config.data.datasets[0].data).toEqual([12, 14, null, null, 13]);
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
