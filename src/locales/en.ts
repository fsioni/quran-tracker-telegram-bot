import type { Locale } from "./types";

export const en: Locale = {
  lang: "en",

  commands: {
    start: "Start the bot",
    help: "Show help",
    session: "Record a reading session",
    go: "Start a reading timer",
    stop: "Stop the timer",
    read: "Read the next page",
    extra: "Record an extra reading",
    kahf: "Read surah Al-Kahf (Friday)",
    import: "Import sessions",
    history: "Session history",
    stats: "Reading statistics",
    progress: "Quran progress",
    undo: "Undo the last session",
    delete: "Delete a session",
    speed: "Reading speed",
    config: "Configure city, country, timezone, language",
    prayer: "Refresh prayer times",
  },

  welcomeHeader: "Welcome to the Quran Reading Tracker!",
  commandsAvailable: "Available commands:",

  error: "Error",
  example: "Example",

  fmt: {
    dateShort: (day, month) => `${day}/${month}`,
    timeShort: (hour, minute) => `${hour}:${minute}`,
    versesPerHourCompact: (n) => `${n}v/h`,
    pagesPerHourCompact: (n) => `${n}p/h`,
    hours: "h",
    minutes: "m",
    seconds: "s",
  },

  config: {
    title: "-- Configuration --",
    cityLabel: "City",
    countryLabel: "Country",
    timezoneLabel: "Timezone",
    languageLabel: "Language",
    defaultSuffix: " (default)",
    missingValue: "missing value",
    cityUpdated: (city) => `City updated: ${city}\nPrayer cache cleared.`,
    countryCodeInvalid: "country code must be 2 letters (ISO)",
    countryUpdated: (country) =>
      `Country updated: ${country}\nPrayer cache cleared.`,
    timezoneInvalid: "invalid timezone",
    timezoneUpdated: (tz) => `Timezone updated: ${tz}`,
    unknownParam: (param) => `unknown parameter '${param}'`,
    languageUpdated: (lang) => `Language updated: ${lang}`,
    languageInvalid: (available) =>
      `invalid language. Available languages: ${available}`,
    languageError: "failed to update language",
  },

  parse: {
    invalidVerseFormat: (input) => `invalid verse format '${input}'. Use 2:77`,
    invalidDurationFormat: (input) =>
      `invalid duration format '${input}'. Use 8m or 8m53`,
    invalidRangeFormat: (input) =>
      `invalid range format '${input}'. Use 2:77-83 or 2:280-3:10`,
    invalidImportLineFormat: (line) =>
      `invalid line format '${line}'. Use DD/MM, HHhMM - DURATION - RANGE`,
    invalidMonth: (month) => `invalid month '${month}' (1-12)`,
    invalidDay: (day, month, max) =>
      `invalid day '${day}' for month ${month} (1-${max})`,
    invalidPage: (page, max) =>
      `invalid page '${page}'. Pages range from 1 to ${max}`,
    pageStartAfterEnd: (start, end) =>
      `start page (${start}) must be less than or equal to end page (${end})`,
    invalidPageFormat: (input) =>
      `invalid page format '${input}'. Use 300 or 300-304`,
    invalidFormat: (example) => `invalid format. Use ${example}`,
    invalidPageCount: (example) => `invalid page count. Use ${example}`,
  },

  examples: {
    session: "/session 2:77-83 8m53",
    read: "/read 5m or /read 3 15m",
    extra: "/extra 300 5m or /extra 2:77-83 8m",
    kahf: "/kahf 5m or /kahf 3 15m",
    import: "/import\n10/03, 13:30 - 8m53 - 2:77-83",
  },

  session: {
    recorded: "Session recorded:",
    extraRecorded: "Extra session recorded:",
    surahFallback: (num) => `Surah ${num}`,
    surah: "surah",
    verses: "verses",
    in: "in",
    versesPerHour: (n) => `${n} verses/h`,
    pagesPerHour: (n) => `${n} pages/h`,
    from: "v.",
    to: "to",
    confirmationSameSurah: (
      surahName,
      ayahStart,
      ayahEnd,
      ayahCount,
      duration,
      speed
    ) =>
      `surah ${surahName} v.${ayahStart} to v.${ayahEnd} -- ${ayahCount} verses in ${duration}${speed}`,
    confirmationCrossSurah: (
      startName,
      ayahStart,
      endName,
      ayahEnd,
      ayahCount,
      duration,
      speed
    ) =>
      `surah ${startName} v.${ayahStart} to surah ${endName} v.${ayahEnd} -- ${ayahCount} verses in ${duration}${speed}`,
  },

  stats: {
    title: "-- Overall stats --",
    versesRead: "Verses read",
    totalDuration: "Total duration",
    averageSpeed: "Average speed",
    versesPerHour: "verses/hour",
    versesPerHourShort: "verses/h",
    pagesPerHourShort: "pages/h",
    currentStreak: (days) =>
      `Current streak: ${days} ${days === 1 ? "day" : "days"}`,
    bestStreak: (days) => `Best streak: ${days} ${days === 1 ? "day" : "days"}`,
    thisWeek: "-- This week --",
    thisMonth: "-- This month --",
    versesLabel: "Verses",
    durationLabel: "Duration",
    speedLabel: "Speed",
    vsLastWeek: (pct) => `${pct} vs last week`,
    noSession: "No session recorded.",
  },

  progress: {
    label: (read, total, pct) =>
      `Progress: ${read} / ${total} verses (${pct}%)`,
    nextPage: (page) => `Next page: ${page}`,
    khatmas: (count) => `Khatmas: ${count}`,
    page: "Page",
  },

  reminder: {
    title: "Quran reading reminder",
    lastSession: (date, surahName, ayah) =>
      `Last session: ${date} - surah ${surahName} v.${ayah}`,
    thisWeek: (sessions, ayahs) =>
      `This week: ${sessions} ${sessions === 1 ? "session" : "sessions"}, ${ayahs} verses`,
    streak: (days) =>
      `Streak: ${days} consecutive ${days === 1 ? "day" : "days"}`,
    keepItUp: "Keep it up!",
    timeToResume: "Time to get back to it!",
    noSession:
      "Quran reading reminder\n\nNo session recorded. Start with /session!",
  },

  read: {
    pageSingularRead: (page, duration) => `Page ${page} read in ${duration}`,
    pagePluralRead: (start, end, duration) =>
      `Pages ${start}-${end} read in ${duration}`,
    quranComplete: "Quran complete! Alhamdulillah!",
    nextPage: (page) => `Next page: ${page}`,
    remainingPages: (count, start, end) =>
      `only ${count} page(s) remaining (page ${start} to ${end})`,
    pagesInvalid: "invalid pages",
    formatInvalid: "invalid format",
  },

  kahf: {
    pageRead: (page, total, duration) =>
      `Al-Kahf page ${page}/${total} read in ${duration}`,
    thisWeek: (pages, total, duration) =>
      `This week: ${pages}/${total} pages, ${duration} total`,
    complete: (page, total, duration) =>
      `Al-Kahf complete! ${page}/${total} pages in ${duration}`,
    lastWeek: (duration) => `Last week: ${duration}`,
    lastWeekFaster: (duration, diff) =>
      `Last week: ${duration} (-${diff}, well done!)`,
    lastWeekSlower: (duration, diff) => `Last week: ${duration} (+${diff})`,
    reminderBase: "Reminder: it's Friday! Remember to read surah Al-Kahf.",
    reminderLast: (date, duration) => `Last reading: ${date} in ${duration}`,
    alreadyComplete: "Al-Kahf already completed this week!",
    remainingPages: (count, start, end) =>
      `only ${count} Al-Kahf page(s) remaining this week (page ${start} to ${end})`,
  },

  months: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],

  estimation: {
    notEnoughData:
      "Not enough recent data to estimate (read regularly to see a projection)",
    monthsRemaining: (pace, months) =>
      `At your current pace (~${pace} pages/day), about ${months} months remaining`,
    dateEstimate: (pace, day, month, year) =>
      `At this pace (~${pace} pages/day), you'll finish around ${month} ${day}, ${year}`,
  },

  khatma: {
    first:
      "Khatma! You have completed your first full reading of the Quran. Alhamdulillah!",
    nth: (n) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      const suffix = s[(v - 20) % 10] || s[v] || s[0];
      return `Khatma! You have completed your ${n}${suffix} full reading of the Quran. Alhamdulillah!`;
    },
  },

  surahComplete: {
    singular: (name, num) => `Surah ${name} (${num}) complete!`,
    plural: (list) => `Surahs completed: ${list}`,
  },

  speed: {
    title: "-- Reading speed --",
    globalAverage: (speed) => `Overall average: ${speed} verses/h`,
    last7Days: (speed) => `Last 7 days average: ${speed} verses/h`,
    last30Days: (speed) => `Last 30 days average: ${speed} verses/h`,
    bestSession: (id, speed, date) =>
      `Best session: #${id} (${speed} verses/h) - ${date}`,
    longestSession: (id, duration, date) =>
      `Longest session: #${id} (${duration}) - ${date}`,
    byType: "By type:",
    typeNormal: "Normal",
    typeExtra: "Extra",
    typeKahf: "Kahf",
    sessionsCount: (count) =>
      `${count} ${count === 1 ? "session" : "sessions"}`,
  },

  recap: {
    title: "-- Weekly recap --",
    noSession: "No session this week. Time to get back to it!",
    pagesRead: "Pages read",
    duration: "Duration",
    sessions: "Sessions",
    streak: (days) =>
      `Streak: ${days} consecutive ${days === 1 ? "day" : "days"}`,
  },

  timer: {
    startedNormalPage: "Timer started! Normal reading (pages).",
    startedNormalVerse: (input) => `Timer started! Reading from ${input}.`,
    startedExtraPage: (page) => `Timer started! Extra reading page ${page}.`,
    startedExtraVerse: (input) => `Timer started! Extra reading from ${input}.`,
    startedKahf: "Timer started! Reading Al-Kahf.",
    alreadyActive: (duration) =>
      `a timer is already active for ${duration}. Use /stop to stop it`,
    noActiveTimer: "No active timer.",
    cancelled: "Timer cancelled.",
    confirmLongTimer: (duration) =>
      `Timer has been running for ${duration} (over 4h). Confirm stop?`,
    questionPages: (duration) =>
      `Session stopped (${duration})\nHow many pages did you read?`,
    questionVerses: (duration) =>
      `Session stopped (${duration})\nWhere did you stop? (e.g. 2:83 or 3:10)`,
    questionKahfPages: (duration) =>
      `Session stopped (${duration})\nHow many Al-Kahf pages did you read?`,
    notFound: "Timer not found.",
    yes: "Yes",
    no: "No",
    stop: "Stop",
    go: "Go",
    quranFinished: "You have finished the Quran! Alhamdulillah!",
    invalidPageCount:
      "invalid page count. Send a number (e.g. 3) or /stop cancel to cancel",
    invalidVerseFormat:
      "invalid verse format. Send e.g. 2:83 or /stop cancel to cancel",
    invalidGoFormat:
      "invalid format\nExample: /go or /go 2:77 or /go extra 300 or /go kahf",
    invalidGoExtraFormat:
      "invalid format\nExample: /go extra 300 or /go extra 2:77",
    overflowPages: (start, end, max) =>
      `overflow: pages ${start}-${end} (max ${max})`,
    internalError: "internal error while processing response",
  },

  manage: {
    confirm: "Confirm",
    cancel: "Cancel",
    deletePrompt: (id, desc) => `Delete session #${id} (${desc})?`,
    noSessionToUndo: "No session to undo.",
    missingId: "missing ID",
    invalidId: (input) => `invalid ID '${input}'`,
    sessionNotFound: (id) => `session #${id} does not exist`,
    sessionDeleted: (id, range, ayahs, duration) =>
      `Session #${id} deleted.\n${range} -- ${ayahs} verses in ${duration}`,
    sessionNotFoundShort: (id) => `Session #${id} not found.`,
    deletionCancelled: "Deletion cancelled.",
  },

  import: {
    noData: "no data to import",
    lineError: (lineNum, error) => `Line ${lineNum}: ${error}`,
    success: (count) => `${count} session${count > 1 ? "s" : ""} imported.`,
    successWithErrors: (count, errorCount, errors) =>
      `${count} session${count > 1 ? "s" : ""} imported, ${errorCount} error${errorCount > 1 ? "s" : ""}:\n${errors}`,
    allFailed: (errorCount, errors) =>
      `No session imported. ${errorCount} error${errorCount > 1 ? "s" : ""}:\n${errors}`,
  },

  prayer: {
    title: (city, country) => `Prayer times - ${city}, ${country}`,
    date: "Date",
    cacheRefreshed: "Cache refreshed.",
    fetchError: (error) => `unable to fetch prayer times: ${error}`,
    fajr: "Fajr",
    dhuhr: "Dhuhr",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
  },

  debug: {
    configSection: "-- Config --",
    prayerCacheSection: "-- Prayer cache --",
    prayerCacheDateSection: (date) => `-- Prayer cache (${date}) --`,
    lastSessionSection: "-- Last session --",
    cronSection: "-- Cron --",
    dbStatsSection: "-- DB stats --",
    systemSection: "-- System --",
    sent: "sent",
    pending: "pending",
    noCache: "no cache",
    noSession: "no session",
    statsError: "stats error",
  },

  validation: {
    surahNotFound: (num) => `surah ${num} does not exist (1-114)`,
    ayahOutOfRange: (surahNum, ayahCount, requested) =>
      `surah ${surahNum} only has ${ayahCount} verses (verse ${requested} requested)`,
    endBeforeStart: (endSurah, endAyah, startSurah, startAyah) =>
      `end (${endSurah}:${endAyah}) is before start (${startSurah}:${startAyah})`,
  },

  prayerApi: {
    invalidResponse: "Invalid Aladhan response",
    missingField: (field) => `Missing field in Aladhan response: ${field}`,
    httpError: (status) => `Aladhan API HTTP ${status}`,
    apiError: (message) => `Aladhan API error: ${message}`,
  },

  nativeName: "English",
};
