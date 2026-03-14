// tests/prayer.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parsePrayerResponse,
  buildAladhanUrl,
  fetchPrayerTimes,
  isReminderTime,
  getDueReminders,
  getNowInTimezone,
} from "../src/services/prayer";
import type { PrayerCacheRow } from "../src/services/db";

describe("parsePrayerResponse", () => {
  it("parse une reponse Aladhan valide", () => {
    const body = {
      code: 200,
      data: {
        timings: {
          Fajr: "05:30", Dhuhr: "12:15", Asr: "15:45",
          Maghrib: "18:30", Isha: "20:00",
          Sunrise: "06:45", Sunset: "18:28",
        },
      },
    };
    const result = parsePrayerResponse(body, "2026-03-14");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        date: "2026-03-14",
        fajr: "05:30", dhuhr: "12:15", asr: "15:45",
        maghrib: "18:30", isha: "20:00",
      });
    }
  });

  it("strip le suffixe timezone des horaires", () => {
    const body = {
      code: 200,
      data: {
        timings: {
          Fajr: "05:30 (EST)", Dhuhr: "12:15 (EST)", Asr: "15:45 (EST)",
          Maghrib: "18:30 (EST)", Isha: "20:00 (EST)",
          Sunrise: "06:45", Sunset: "18:28",
        },
      },
    };
    const result = parsePrayerResponse(body, "2026-03-14");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fajr).toBe("05:30");
    }
  });

  it("retourne erreur si code != 200", () => {
    const body = { code: 400, data: { timings: {} } };
    const result = parsePrayerResponse(body as any, "2026-03-14");
    expect(result.ok).toBe(false);
  });

  it("retourne erreur si timings absent", () => {
    const body = { code: 200, data: {} };
    const result = parsePrayerResponse(body as any, "2026-03-14");
    expect(result.ok).toBe(false);
  });

  it("retourne erreur si un champ requis manque", () => {
    const body = {
      code: 200,
      data: {
        timings: {
          Fajr: "05:30", Dhuhr: "12:15", Asr: "15:45",
          Maghrib: "18:30",
          // Isha missing
        },
      },
    };
    const result = parsePrayerResponse(body as any, "2026-03-14");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Isha");
  });
});

describe("buildAladhanUrl", () => {
  it("convertit YYYY-MM-DD en DD-MM-YYYY pour Aladhan", () => {
    const url = buildAladhanUrl("2026-03-14", "Playa del Carmen", "MX");
    expect(url).toBe(
      "https://api.aladhan.com/v1/timingsByCity/14-03-2026?city=Playa%20del%20Carmen&country=MX&method=2",
    );
  });
});

describe("fetchPrayerTimes", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("retourne les horaires en cas de succes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 200,
        data: {
          timings: {
            Fajr: "05:30", Dhuhr: "12:15", Asr: "15:45",
            Maghrib: "18:30", Isha: "20:00",
            Sunrise: "06:45", Sunset: "18:28",
          },
        },
      }),
    }));

    const result = await fetchPrayerTimes("2026-03-14", "Playa del Carmen", "MX");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.fajr).toBe("05:30");
  });

  it("retourne erreur si HTTP echoue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await fetchPrayerTimes("2026-03-14", "Playa del Carmen", "MX");
    expect(result.ok).toBe(false);
  });

  it("retourne erreur si fetch throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await fetchPrayerTimes("2026-03-14", "Playa del Carmen", "MX");
    expect(result.ok).toBe(false);
  });
});

describe("isReminderTime", () => {
  it("true a prayer+10min (borne inf)", () => {
    expect(isReminderTime("12:10", "12:00")).toBe(true);
  });
  it("true a prayer+14min (borne sup)", () => {
    expect(isReminderTime("12:14", "12:00")).toBe(true);
  });
  it("false a prayer+9min (trop tot)", () => {
    expect(isReminderTime("12:09", "12:00")).toBe(false);
  });
  it("false a prayer+15min (trop tard)", () => {
    expect(isReminderTime("12:15", "12:00")).toBe(false);
  });
  it("true a prayer+12min (milieu)", () => {
    expect(isReminderTime("12:12", "12:00")).toBe(true);
  });
  it("false sur passage minuit (cas impossible en pratique)", () => {
    expect(isReminderTime("00:05", "23:55")).toBe(false);
  });
});

const makeCache = (overrides: Partial<PrayerCacheRow> = {}): PrayerCacheRow => ({
  date: "2026-03-14",
  fajr: "05:30", dhuhr: "12:00", asr: "15:45", maghrib: "18:30", isha: "20:00",
  fajr_sent: 0, dhuhr_sent: 0, asr_sent: 0, maghrib_sent: 0, isha_sent: 0,
  fetched_at: "2026-03-14 00:00:00",
  ...overrides,
});

describe("getDueReminders", () => {
  it("retourne la priere dans la fenetre", () => {
    expect(getDueReminders(makeCache(), "12:12")).toEqual(["dhuhr"]);
  });

  it("retourne [] si deja envoyee", () => {
    expect(getDueReminders(makeCache({ dhuhr_sent: 1 }), "12:12")).toEqual([]);
  });

  it("retourne [] si aucune priere dans la fenetre", () => {
    expect(getDueReminders(makeCache(), "14:00")).toEqual([]);
  });
});

describe("getNowInTimezone", () => {
  it("retourne un format HH:MM", () => {
    const now = getNowInTimezone("America/Cancun");
    expect(now).toMatch(/^\d{2}:\d{2}$/);
  });
});
