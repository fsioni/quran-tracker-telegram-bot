// tests/handlers/speed.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { speedHandler } from "../../src/handlers/stats";
import type { CustomContext } from "../../src/bot";
import type { Session } from "../../src/services/db";
import { fr } from "../../src/locales/fr";

vi.mock("../../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/db")>();
  return {
    ...actual,
    getTimezone: vi.fn(),
    getSpeedAverages: vi.fn(),
    getBestSpeedSession: vi.fn(),
    getLongestSession: vi.fn(),
    getSpeedByType: vi.fn(),
  };
});

import {
  getTimezone,
  getSpeedAverages,
  getBestSpeedSession,
  getLongestSession,
  getSpeedByType,
} from "../../src/services/db";

function makeCtx(): CustomContext {
  return {
    match: "",
    reply: vi.fn().mockResolvedValue(undefined),
    db: {} as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

const MOCK_SESSION: Session = {
  id: 42,
  startedAt: "2026-03-10 13:30:00",
  durationSeconds: 533,
  surahStart: 2,
  ayahStart: 77,
  surahEnd: 2,
  ayahEnd: 83,
  ayahCount: 7,
  type: "normal",
  pageStart: null,
  pageEnd: null,
  createdAt: "2026-03-10 13:30:00",
};

describe("speedHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
  });

  it("affiche le rapport complet avec toutes les donnees", async () => {
    vi.mocked(getSpeedAverages).mockResolvedValue({
      global: 155,
      last7Days: 162,
      last30Days: 148,
    });
    vi.mocked(getBestSpeedSession).mockResolvedValue({
      ...MOCK_SESSION,
      ayahCount: 50,
      durationSeconds: 800,
    });
    vi.mocked(getLongestSession).mockResolvedValue({
      ...MOCK_SESSION,
      id: 38,
      startedAt: "2026-03-08 10:00:00",
      durationSeconds: 4320,
    });
    vi.mocked(getSpeedByType).mockResolvedValue([
      { type: "normal", avgSpeed: 155, sessionCount: 45, unit: "verses" },
      { type: "extra", avgSpeed: 180, sessionCount: 12, unit: "verses" },
      { type: "kahf", avgSpeed: 8.5, sessionCount: 8, unit: "pages" },
    ]);

    const ctx = makeCtx();
    await speedHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("-- Vitesse de lecture --");
    expect(msg).toContain("Moyenne globale : 155 versets/h");
    expect(msg).toContain("Moyenne 7 derniers jours : 162 versets/h");
    expect(msg).toContain("Moyenne 30 derniers jours : 148 versets/h");
    expect(msg).toContain("Meilleure session : #42");
    expect(msg).toContain("Plus longue session : #38 (1h12m) - 08/03");
    expect(msg).toContain("Par type :");
    expect(msg).toContain("Normal");
    expect(msg).toContain("Extra");
    expect(msg).toContain("Kahf");
  });

  it("repond 'Aucune session enregistree.' quand aucune session", async () => {
    vi.mocked(getSpeedAverages).mockResolvedValue({
      global: null,
      last7Days: null,
      last30Days: null,
    });
    vi.mocked(getBestSpeedSession).mockResolvedValue(null);
    vi.mocked(getLongestSession).mockResolvedValue(null);
    vi.mocked(getSpeedByType).mockResolvedValue([]);

    const ctx = makeCtx();
    await speedHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("Aucune session enregistree.");
  });

  it("gere le cas partiel : pas de sessions dans les 7 derniers jours", async () => {
    vi.mocked(getSpeedAverages).mockResolvedValue({
      global: 140,
      last7Days: null,
      last30Days: 140,
    });
    vi.mocked(getBestSpeedSession).mockResolvedValue(MOCK_SESSION);
    vi.mocked(getLongestSession).mockResolvedValue(MOCK_SESSION);
    vi.mocked(getSpeedByType).mockResolvedValue([
      { type: "normal", avgSpeed: 140, sessionCount: 10, unit: "verses" },
    ]);

    const ctx = makeCtx();
    await speedHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Moyenne globale : 140 versets/h");
    expect(msg).not.toContain("Moyenne 7 derniers jours");
    expect(msg).toContain("Moyenne 30 derniers jours : 140 versets/h");
  });

  it("gere le cas sans records : toutes sessions < 60s", async () => {
    vi.mocked(getSpeedAverages).mockResolvedValue({
      global: 200,
      last7Days: 200,
      last30Days: 200,
    });
    vi.mocked(getBestSpeedSession).mockResolvedValue(null);
    vi.mocked(getLongestSession).mockResolvedValue({
      ...MOCK_SESSION,
      durationSeconds: 45,
    });
    vi.mocked(getSpeedByType).mockResolvedValue([
      { type: "normal", avgSpeed: 200, sessionCount: 5, unit: "verses" },
    ]);

    const ctx = makeCtx();
    await speedHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Moyenne globale : 200 versets/h");
    expect(msg).not.toContain("Meilleure session");
    expect(msg).toContain("Plus longue session");
  });

  it("appelle les fonctions DB en parallele", async () => {
    vi.mocked(getSpeedAverages).mockResolvedValue({ global: null, last7Days: null, last30Days: null });
    vi.mocked(getBestSpeedSession).mockResolvedValue(null);
    vi.mocked(getLongestSession).mockResolvedValue(null);
    vi.mocked(getSpeedByType).mockResolvedValue([]);

    const ctx = makeCtx();
    await speedHandler(ctx);

    expect(getTimezone).toHaveBeenCalledWith(ctx.db);
    expect(getSpeedAverages).toHaveBeenCalledWith(ctx.db, "America/Cancun");
    expect(getBestSpeedSession).toHaveBeenCalledWith(ctx.db);
    expect(getLongestSession).toHaveBeenCalledWith(ctx.db);
    expect(getSpeedByType).toHaveBeenCalledWith(ctx.db);
  });
});
