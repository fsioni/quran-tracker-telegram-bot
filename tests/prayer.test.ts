// tests/prayer.test.ts
const TIME_FORMAT_RE = /^\d{2}:\d{2}$/;

import { afterEach, describe, expect, it, vi } from "vitest";
import { fr } from "../src/locales/fr";
import type { PrayerCacheRow } from "../src/services/db";
import {
  buildAladhanUrl,
  fetchPrayerTimes,
  getDueReminders,
  getNowInTimezone,
  isReminderDue,
  parsePrayerResponse,
} from "../src/services/prayer";

describe("parsePrayerResponse", () => {
  it("parse une reponse Aladhan valide", () => {
    const body = {
      code: 200,
      data: {
        timings: {
          Fajr: "05:30",
          Dhuhr: "12:15",
          Asr: "15:45",
          Maghrib: "18:30",
          Isha: "20:00",
          Sunrise: "06:45",
          Sunset: "18:28",
        },
      },
    };
    const result = parsePrayerResponse(body, "2026-03-14", fr);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        date: "2026-03-14",
        fajr: "05:30",
        dhuhr: "12:15",
        asr: "15:45",
        maghrib: "18:30",
        isha: "20:00",
      });
    }
  });

  it("strip le suffixe timezone des horaires", () => {
    const body = {
      code: 200,
      data: {
        timings: {
          Fajr: "05:30 (EST)",
          Dhuhr: "12:15 (EST)",
          Asr: "15:45 (EST)",
          Maghrib: "18:30 (EST)",
          Isha: "20:00 (EST)",
          Sunrise: "06:45",
          Sunset: "18:28",
        },
      },
    };
    const result = parsePrayerResponse(body, "2026-03-14", fr);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fajr).toBe("05:30");
    }
  });

  it("retourne erreur si code != 200", () => {
    const body = { code: 400, data: { timings: {} } };
    const result = parsePrayerResponse(body as any, "2026-03-14", fr);
    expect(result.ok).toBe(false);
  });

  it("retourne erreur si timings absent", () => {
    const body = { code: 200, data: {} };
    const result = parsePrayerResponse(body as any, "2026-03-14", fr);
    expect(result.ok).toBe(false);
  });

  it("retourne erreur si un champ requis manque", () => {
    const body = {
      code: 200,
      data: {
        timings: {
          Fajr: "05:30",
          Dhuhr: "12:15",
          Asr: "15:45",
          Maghrib: "18:30",
          // Isha missing
        },
      },
    };
    const result = parsePrayerResponse(body as any, "2026-03-14", fr);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Isha");
    }
  });
});

describe("buildAladhanUrl", () => {
  it("convertit YYYY-MM-DD en DD-MM-YYYY pour Aladhan", () => {
    const url = buildAladhanUrl("2026-03-14", "Playa del Carmen", "MX");
    expect(url).toBe(
      "https://api.aladhan.com/v1/timingsByCity/14-03-2026?city=Playa%20del%20Carmen&country=MX&method=99&methodSettings=18,0,17"
    );
  });
});

describe("fetchPrayerTimes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne les horaires en cas de succes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 200,
            data: {
              timings: {
                Fajr: "05:30",
                Dhuhr: "12:15",
                Asr: "15:45",
                Maghrib: "18:30",
                Isha: "20:00",
                Sunrise: "06:45",
                Sunset: "18:28",
              },
            },
          }),
      })
    );

    const result = await fetchPrayerTimes(
      "2026-03-14",
      "Playa del Carmen",
      "MX",
      fr
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fajr).toBe("05:30");
    }
  });

  it("retourne erreur si HTTP echoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );
    const result = await fetchPrayerTimes(
      "2026-03-14",
      "Playa del Carmen",
      "MX",
      fr
    );
    expect(result.ok).toBe(false);
  });

  it("retourne erreur si fetch throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await fetchPrayerTimes(
      "2026-03-14",
      "Playa del Carmen",
      "MX",
      fr
    );
    expect(result.ok).toBe(false);
  });
});

describe("isReminderDue", () => {
  it("true a l'heure exacte de la priere", () => {
    expect(isReminderDue("12:00", "12:00")).toBe(true);
  });
  it("true 1min apres la priere", () => {
    expect(isReminderDue("12:01", "12:00")).toBe(true);
  });
  it("true 30min apres la priere (tick retarde)", () => {
    expect(isReminderDue("12:30", "12:00")).toBe(true);
  });
  it("false 1min avant la priere", () => {
    expect(isReminderDue("11:59", "12:00")).toBe(false);
  });
  it("false sur passage minuit (diff negatif)", () => {
    expect(isReminderDue("00:05", "23:55")).toBe(false);
  });
});

const makeCache = (
  overrides: Partial<PrayerCacheRow> = {}
): PrayerCacheRow => ({
  date: "2026-03-14",
  fajr: "05:30",
  dhuhr: "12:00",
  asr: "15:45",
  maghrib: "18:30",
  isha: "20:00",
  fajr_sent: 0,
  dhuhr_sent: 0,
  asr_sent: 0,
  maghrib_sent: 0,
  isha_sent: 0,
  fetched_at: "2026-03-14 00:00:00",
  ...overrides,
});

describe("getDueReminders", () => {
  it("retourne toutes les prieres passees non envoyees", () => {
    expect(getDueReminders(makeCache(), "12:00")).toEqual(["fajr", "dhuhr"]);
  });

  it("retourne la priere meme avec un tick tres retarde", () => {
    expect(getDueReminders(makeCache({ fajr_sent: 1 }), "12:30")).toEqual([
      "dhuhr",
    ]);
  });

  it("retourne [] si deja envoyee", () => {
    expect(
      getDueReminders(makeCache({ fajr_sent: 1, dhuhr_sent: 1 }), "12:30")
    ).toEqual([]);
  });

  it("retourne [] si aucune priere n'est encore passee", () => {
    expect(getDueReminders(makeCache(), "05:29")).toEqual([]);
  });

  it("retourne plusieurs prieres si tick retarde couvre plusieurs", () => {
    expect(getDueReminders(makeCache(), "20:00")).toEqual([
      "fajr",
      "dhuhr",
      "asr",
      "maghrib",
      "isha",
    ]);
  });

  it("exclut les prieres deja envoyees parmi plusieurs dues", () => {
    expect(
      getDueReminders(makeCache({ fajr_sent: 1, dhuhr_sent: 1 }), "20:00")
    ).toEqual(["asr", "maghrib", "isha"]);
  });
});

describe("getNowInTimezone", () => {
  it("retourne un format HH:MM", () => {
    const now = getNowInTimezone("America/Cancun");
    expect(now).toMatch(TIME_FORMAT_RE);
  });
});
