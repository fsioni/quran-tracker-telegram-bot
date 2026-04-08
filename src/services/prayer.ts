import type { Locale } from "../locales/types";
import { err, ok, type Result } from "../types";
import type { PrayerCacheRow, PrayerName, PrayerTimes } from "./db/types";

interface AladhanTimings {
  Asr: string;
  Dhuhr: string;
  Fajr: string;
  Isha: string;
  Maghrib: string;
  [key: string]: string;
}

interface AladhanResponse {
  code: number;
  data: {
    timings: AladhanTimings;
  };
}

const TIMEZONE_SUFFIX_RE = /\s*\(.*\)$/;

function stripTimezone(time: string): string {
  return time.replace(TIMEZONE_SUFFIX_RE, "").trim();
}

const REQUIRED_TIMINGS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

export function parsePrayerResponse(
  body: AladhanResponse,
  date: string,
  t: Locale
): Result<PrayerTimes> {
  if (body.code !== 200 || !body.data?.timings) {
    return err(t.prayerApi.invalidResponse);
  }
  const timings = body.data.timings;
  for (const key of REQUIRED_TIMINGS) {
    if (typeof timings[key] !== "string") {
      return err(t.prayerApi.missingField(key));
    }
  }
  return ok({
    date,
    fajr: stripTimezone(timings.Fajr),
    dhuhr: stripTimezone(timings.Dhuhr),
    asr: stripTimezone(timings.Asr),
    maghrib: stripTimezone(timings.Maghrib),
    isha: stripTimezone(timings.Isha),
  });
}

export function buildAladhanUrl(
  date: string,
  city: string,
  country: string
): string {
  const [y, m, d] = date.split("-");
  return `https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=99&methodSettings=18,0,17`;
}

export async function fetchPrayerTimes(
  date: string,
  city: string,
  country: string,
  t: Locale
): Promise<Result<PrayerTimes>> {
  try {
    const url = buildAladhanUrl(date, city, country);
    const response = await fetch(url);
    if (!response.ok) {
      return err(t.prayerApi.httpError(response.status));
    }
    const body = (await response.json()) as AladhanResponse;
    return parsePrayerResponse(body, date, t);
  } catch (e) {
    return err(t.prayerApi.apiError((e as Error).message));
  }
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function addMinutesToHHMM(hhmm: string, minutes: number): string {
  const minutesPerDay = 24 * 60;
  const total =
    (((timeToMinutes(hhmm) + minutes) % minutesPerDay) + minutesPerDay) %
    minutesPerDay;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function isReminderDue(nowHHMM: string, prayerHHMM: string): boolean {
  const diff = timeToMinutes(nowHHMM) - timeToMinutes(prayerHHMM);
  return diff >= 0;
}

const PRAYER_NAMES: readonly PrayerName[] = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

export function getDueReminders(
  cache: PrayerCacheRow,
  nowHHMM: string
): PrayerName[] {
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
