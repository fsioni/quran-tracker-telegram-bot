import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomContext } from "../../src/bot";
import { fr } from "../../src/locales/fr";

vi.mock("../../src/services/db/config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/config")>();
  return { ...actual, getConfig: vi.fn() };
});
vi.mock("../../src/services/db/date-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/date-helpers")>();
  return {
    ...actual,
    getTimezone: vi.fn(),
    getTodayInTimezone: vi.fn(),
    getNowTimestamp: vi.fn(),
  };
});
vi.mock("../../src/services/db/prayer", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/prayer")>();
  return { ...actual, getPrayerCache: vi.fn() };
});
vi.mock("../../src/services/db/sessions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/sessions")>();
  return { ...actual, getLastSession: vi.fn() };
});
vi.mock("../../src/services/db/stats", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/stats")>();
  return { ...actual, getGlobalStats: vi.fn() };
});

import { debugHandler } from "../../src/handlers/debug";
import { getConfig } from "../../src/services/db/config";
import {
  getNowTimestamp,
  getTimezone,
  getTodayInTimezone,
} from "../../src/services/db/date-helpers";
import { getPrayerCache } from "../../src/services/db/prayer";
import { getLastSession } from "../../src/services/db/sessions";
import { getGlobalStats } from "../../src/services/db/stats";

function createMockContext(): CustomContext {
  return {
    reply: vi.fn().mockResolvedValue(undefined),
    db: {} as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

function setupMocks(
  overrides: { prayerCache?: null; lastSession?: null } = {}
) {
  vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
  vi.mocked(getTodayInTimezone).mockReturnValue("2026-03-15");
  vi.mocked(getNowTimestamp).mockReturnValue("2026-03-15 09:30:00");

  vi.mocked(getConfig).mockImplementation((_db, key) => {
    const values: Record<string, string> = {
      city: "Playa del Carmen",
      country: "MX",
      chat_id: "123456",
      kahf_reminder_last: "2026-03-14",
    };
    return Promise.resolve(values[key] ?? null);
  });

  if (overrides.prayerCache === null) {
    vi.mocked(getPrayerCache).mockResolvedValue(null);
  } else {
    vi.mocked(getPrayerCache).mockResolvedValue({
      date: "2026-03-15",
      fajr: "05:30",
      dhuhr: "12:15",
      asr: "15:45",
      maghrib: "18:20",
      isha: "19:45",
      fajr_sent: 1,
      dhuhr_sent: 0,
      asr_sent: 0,
      maghrib_sent: 0,
      isha_sent: 0,
      fetched_at: "2026-03-15T06:00:00",
    });
  }

  if (overrides.lastSession === null) {
    vi.mocked(getLastSession).mockResolvedValue(null);
  } else {
    vi.mocked(getLastSession).mockResolvedValue({
      id: 42,
      startedAt: "2026-03-15 08:30:00",
      durationSeconds: 600,
      pageStart: null,
      pageEnd: null,
      surahStart: 2,
      ayahStart: 77,
      surahEnd: 2,
      ayahEnd: 83,
      ayahCount: 7,
      type: "normal",
      createdAt: "2026-03-15 08:30:00",
    });
  }

  vi.mocked(getGlobalStats).mockResolvedValue({
    ok: true,
    value: {
      totalSessions: 42,
      totalAyahs: 500,
      totalSeconds: 36_000,
      avgAyahsPerSession: 12,
      avgSecondsPerSession: 857,
      totalPages: 0,
      totalPageSeconds: 0,
    },
  });
}

describe("debugHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche toutes les sections", async () => {
    setupMocks();
    const ctx = createMockContext();
    await debugHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("-- Config --");
    expect(msg).toContain("Playa del Carmen");
    expect(msg).toContain("MX");
    expect(msg).toContain("America/Cancun");
    expect(msg).toContain("123456");
    expect(msg).toContain("-- Cache prière (2026-03-15) --");
    expect(msg).toContain("05:30");
    expect(msg).toContain("[envoyé]");
    expect(msg).toContain("[en attente]");
    expect(msg).toContain("-- Dernière session --");
    expect(msg).toContain("id         : 42");
    expect(msg).toContain("15/03 08h30");
    expect(msg).toContain("normal");
    expect(msg).toContain("2:77-83");
    expect(msg).toContain("-- Cron --");
    expect(msg).toContain("2026-03-14");
    expect(msg).toContain("-- DB stats --");
    expect(msg).toContain("total sessions : 42");
    expect(msg).toContain("-- Système --");
    expect(msg).toContain("serveur (UTC)");
    expect(msg).toContain("user (tz)");
  });

  it("affiche 'aucun cache' si cache priere vide", async () => {
    setupMocks({ prayerCache: null });
    const ctx = createMockContext();
    await debugHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("aucun cache");
    expect(msg).not.toContain("fajr");
  });

  it("affiche 'aucune session' si pas de session", async () => {
    setupMocks({ lastSession: null });
    const ctx = createMockContext();
    await debugHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("aucune session");
    expect(msg).not.toContain("range");
  });

  it("utilise parse_mode MarkdownV2", async () => {
    setupMocks();
    const ctx = createMockContext();
    await debugHandler(ctx);

    const callArgs = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).toEqual({ parse_mode: "MarkdownV2" });
  });
});
