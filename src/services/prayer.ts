import type { PrayerTimes, PrayerCacheRow, PrayerName } from "./db";
import { Result, ok, err } from "../types";

type AladhanTimings = {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  [key: string]: string;
};

type AladhanResponse = {
  code: number;
  data: {
    timings: AladhanTimings;
  };
};

function stripTimezone(time: string): string {
  return time.replace(/\s*\(.*\)$/, "").trim();
}

const REQUIRED_TIMINGS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

export function parsePrayerResponse(body: AladhanResponse, date: string): Result<PrayerTimes> {
  if (body.code !== 200 || !body.data?.timings) {
    return err("Reponse Aladhan invalide");
  }
  const t = body.data.timings;
  for (const key of REQUIRED_TIMINGS) {
    if (typeof t[key] !== "string") {
      return err(`Champ manquant dans la reponse Aladhan: ${key}`);
    }
  }
  return ok({
    date,
    fajr: stripTimezone(t.Fajr),
    dhuhr: stripTimezone(t.Dhuhr),
    asr: stripTimezone(t.Asr),
    maghrib: stripTimezone(t.Maghrib),
    isha: stripTimezone(t.Isha),
  });
}

export function buildAladhanUrl(date: string, city: string, country: string): string {
  const [y, m, d] = date.split("-");
  return `https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=99&methodSettings=18,0,17`;
}

export async function fetchPrayerTimes(
  date: string,
  city: string,
  country: string,
): Promise<Result<PrayerTimes>> {
  try {
    const url = buildAladhanUrl(date, city, country);
    const response = await fetch(url);
    if (!response.ok) {
      return err(`Aladhan API HTTP ${response.status}`);
    }
    const body = (await response.json()) as AladhanResponse;
    return parsePrayerResponse(body, date);
  } catch (e) {
    return err(`Aladhan API erreur: ${(e as Error).message}`);
  }
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isReminderDue(nowHHMM: string, prayerHHMM: string): boolean {
  const diff = timeToMinutes(nowHHMM) - timeToMinutes(prayerHHMM);
  return diff >= 0;
}

const PRAYER_NAMES: readonly PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export function getDueReminders(cache: PrayerCacheRow, nowHHMM: string): PrayerName[] {
  return PRAYER_NAMES.filter((name) => {
    const prayerTime = cache[name];
    const sentFlag = cache[`${name}_sent` as keyof PrayerCacheRow] as number;
    return sentFlag === 0 && isReminderDue(nowHHMM, prayerTime);
  });
}

export function getNowInTimezone(tz: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(new Date());
}
