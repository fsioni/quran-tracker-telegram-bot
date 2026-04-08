export type SessionType = "normal" | "extra" | "kahf";

export interface SessionRow {
  ayah_count: number;
  ayah_end: number;
  ayah_start: number;
  created_at: string;
  duration_seconds: number | null;
  id: number;
  page_end: number | null;
  page_start: number | null;
  started_at: string;
  surah_end: number;
  surah_start: number;
  type: string;
}

export interface Session {
  ayahCount: number;
  ayahEnd: number;
  ayahStart: number;
  createdAt: string;
  durationSeconds: number | null;
  id: number;
  pageEnd: number | null;
  pageStart: number | null;
  startedAt: string;
  surahEnd: number;
  surahStart: number;
  type: SessionType;
}

export interface GlobalStats {
  avgAyahsPerSession: number;
  avgSecondsPerSession: number;
  totalAyahs: number;
  totalPageSeconds: number;
  totalPages: number;
  totalSeconds: number;
  totalSessions: number;
}

export interface PeriodStats {
  ayahs: number;
  pageSeconds: number;
  pages: number;
  seconds: number;
  sessions: number;
}

export interface StreakResult {
  bestStreak: number;
  currentStreak: number;
}

export interface DailySpeedPoint {
  day: string; // "2026-03-15"
  pages: number; // total pages that day
  speed: number; // pages/h
}

export interface SpeedAverages {
  global: number | null;
  last7Days: number | null;
  last30Days: number | null;
}

export interface TypeSpeed {
  avgSpeed: number;
  sessionCount: number;
  type: SessionType;
}

export interface PrayerTimes {
  asr: string;
  date: string;
  dhuhr: string;
  fajr: string;
  isha: string;
  maghrib: string;
}

export type PrayerCacheRow = PrayerTimes & {
  fajr_sent: number;
  dhuhr_sent: number;
  asr_sent: number;
  maghrib_sent: number;
  isha_sent: number;
  fetched_at: string;
};

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export interface InsertSessionData {
  ayahCount: number;
  ayahEnd: number;
  ayahStart: number;
  durationSeconds: number | null;
  pageEnd?: number;
  pageStart?: number;
  startedAt: string;
  surahEnd: number;
  surahStart: number;
  type?: SessionType;
}

export type TimerType =
  | "normal_page"
  | "normal_verse"
  | "extra_page"
  | "extra_verse"
  | "kahf";

export interface TimerState {
  args: string;
  awaitingResponse: boolean;
  durationSeconds?: number;
  startedAt: string;
  startedEpoch: number;
  type: TimerType;
}
