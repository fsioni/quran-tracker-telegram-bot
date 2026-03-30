// tests/handlers/speed.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomContext } from "../../src/bot";
import { speedHandler } from "../../src/handlers/stats";
import { fr } from "../../src/locales/fr";
import type { Session } from "../../src/services/db";

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
  getBestSpeedSession,
  getLongestSession,
  getSpeedAverages,
  getSpeedByType,
  getTimezone,
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
      global: 15.5,
      last7Days: 16.2,
      last30Days: 14.8,
    });
    vi.mocked(getBestSpeedSession).mockResolvedValue({
      ...MOCK_SESSION,
      ayahCount: 50,
      durationSeconds: 800,
      pageStart: 1,
      pageEnd: 5,
    });
    vi.mocked(getLongestSession).mockResolvedValue({
      ...MOCK_SESSION,
      id: 38,
      startedAt: "2026-03-08 10:00:00",
      durationSeconds: 4320,
    });
    vi.mocked(getSpeedByType).mockResolvedValue([
      { type: "normal", avgSpeed: 15.2, sessionCount: 45 },
      { type: "extra", avgSpeed: 17.1, sessionCount: 12 },
      { type: "kahf", avgSpeed: 8.5, sessionCount: 8 },
    ]);

    const ctx = makeCtx();
    await speedHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("-- Vitesse de lecture --");
    expect(msg).toContain("Moyenne globale : 15.5 pages/h");
    expect(msg).toContain("Moyenne 7 derniers jours : 16.2 pages/h");
    expect(msg).toContain("Moyenne 30 derniers jours : 14.8 pages/h");
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

    expect(ctx.reply).toHaveBeenCalledWith("Aucune session enregistrée.");
  });

  it("gere le cas partiel : pas de sessions dans les 7 derniers jours", async () => {
    vi.mocked(getSpeedAverages).mockResolvedValue({
      global: 12.4,
      last7Days: null,
      last30Days: 12.4,
    });
    vi.mocked(getBestSpeedSession).mockResolvedValue({
      ...MOCK_SESSION,
      pageStart: 10,
      pageEnd: 10,
    });
    vi.mocked(getLongestSession).mockResolvedValue(MOCK_SESSION);
    vi.mocked(getSpeedByType).mockResolvedValue([
      { type: "normal", avgSpeed: 12.4, sessionCount: 10 },
    ]);

    const ctx = makeCtx();
    await speedHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Moyenne globale : 12.4 pages/h");
    expect(msg).not.toContain("Moyenne 7 derniers jours");
    expect(msg).toContain("Moyenne 30 derniers jours : 12.4 pages/h");
  });

  it("gere le cas sans records : toutes sessions < 60s", async () => {
    vi.mocked(getSpeedAverages).mockResolvedValue({
      global: 18.0,
      last7Days: 18.0,
      last30Days: 18.0,
    });
    vi.mocked(getBestSpeedSession).mockResolvedValue(null);
    vi.mocked(getLongestSession).mockResolvedValue({
      ...MOCK_SESSION,
      durationSeconds: 45,
    });
    vi.mocked(getSpeedByType).mockResolvedValue([
      { type: "normal", avgSpeed: 18, sessionCount: 5 },
    ]);

    const ctx = makeCtx();
    await speedHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Moyenne globale : 18.0 pages/h");
    expect(msg).not.toContain("Meilleure session");
    expect(msg).toContain("Plus longue session");
  });

  it("appelle les fonctions DB en parallele", async () => {
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

    expect(getTimezone).toHaveBeenCalledWith(ctx.db);
    expect(getSpeedAverages).toHaveBeenCalledWith(ctx.db, "America/Cancun");
    expect(getBestSpeedSession).toHaveBeenCalledWith(ctx.db);
    expect(getLongestSession).toHaveBeenCalledWith(ctx.db);
    expect(getSpeedByType).toHaveBeenCalledWith(ctx.db);
  });
});
