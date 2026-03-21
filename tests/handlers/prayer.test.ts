import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CustomContext } from "../../src/bot";
import { fr } from "../../src/locales/fr";

vi.mock("../../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/db")>();
  return {
    ...actual,
    getConfig: vi.fn(),
    getTodayInTimezone: vi.fn().mockReturnValue("2026-03-18"),
    deletePrayerCacheForDate: vi.fn(),
    setPrayerCache: vi.fn(),
  };
});

vi.mock("../../src/services/prayer", () => ({
  fetchPrayerTimes: vi.fn(),
}));

import { getConfig, getTodayInTimezone, deletePrayerCacheForDate, setPrayerCache } from "../../src/services/db";
import { fetchPrayerTimes } from "../../src/services/prayer";
import { prayerHandler } from "../../src/handlers/prayer";

function makeCtx(): CustomContext {
  return {
    reply: vi.fn().mockResolvedValue(undefined),
    db: {} as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

const MOCK_TIMES = {
  date: "2026-03-18",
  fajr: "05:30",
  dhuhr: "12:15",
  asr: "15:45",
  maghrib: "18:30",
  isha: "20:00",
};

describe("prayerHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockResolvedValue(null);
  });

  it("deletes cache, fetches, stores, and replies with times on success", async () => {
    vi.mocked(fetchPrayerTimes).mockResolvedValue({ ok: true, value: MOCK_TIMES });

    const ctx = makeCtx();
    await prayerHandler(ctx);

    expect(fetchPrayerTimes).toHaveBeenCalledWith("2026-03-18", "Mecca", "SA", fr);
    expect(deletePrayerCacheForDate).toHaveBeenCalledWith(ctx.db, "2026-03-18");
    expect(setPrayerCache).toHaveBeenCalledWith(ctx.db, MOCK_TIMES);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Fajr : 05:30");
    expect(msg).toContain("Dhuhr : 12:15");
    expect(msg).toContain("Asr : 15:45");
    expect(msg).toContain("Maghrib : 18:30");
    expect(msg).toContain("Isha : 20:00");
    expect(msg).toContain("rafraichi");
  });

  it("does not delete cache when fetch fails", async () => {
    vi.mocked(fetchPrayerTimes).mockResolvedValue({ ok: false, error: "API down" });

    const ctx = makeCtx();
    await prayerHandler(ctx);

    expect(deletePrayerCacheForDate).not.toHaveBeenCalled();
    expect(setPrayerCache).not.toHaveBeenCalled();

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("API down");
  });

  it("uses config values when set", async () => {
    vi.mocked(getConfig)
      .mockResolvedValueOnce("Asia/Riyadh")
      .mockResolvedValueOnce("Riyadh")
      .mockResolvedValueOnce("SA");
    vi.mocked(fetchPrayerTimes).mockResolvedValue({ ok: true, value: MOCK_TIMES });

    const ctx = makeCtx();
    await prayerHandler(ctx);

    expect(getTodayInTimezone).toHaveBeenCalledWith("Asia/Riyadh");
    expect(fetchPrayerTimes).toHaveBeenCalledWith("2026-03-18", "Riyadh", "SA", fr);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Riyadh");
    expect(msg).toContain("SA");
  });
});
