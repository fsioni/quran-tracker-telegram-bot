export type Locale = {
  // Bot command descriptions
  commands: {
    start: string;
    help: string;
    session: string;
    go: string;
    stop: string;
    read: string;
    extra: string;
    kahf: string;
    import: string;
    history: string;
    stats: string;
    progress: string;
    undo: string;
    delete: string;
    speed: string;
    config: string;
    prayer: string;
  };

  // Welcome/help message
  welcomeHeader: string;
  commandsAvailable: string;

  // Error/example prefixes
  error: string;
  example: string;

  // Common formatting helpers
  fmt: {
    dateShort: (day: string, month: string) => string;
    timeShort: (hour: string, minute: string) => string;
    versesPerHourCompact: (n: number) => string;
    pagesPerHourCompact: (n: string) => string;
  };

  // Config handler
  config: {
    title: string;
    cityLabel: string;
    countryLabel: string;
    timezoneLabel: string;
    languageLabel: string;
    defaultSuffix: string;
    missingValue: string;
    cityUpdated: (city: string) => string;
    countryCodeInvalid: string;
    countryUpdated: (country: string) => string;
    timezoneInvalid: string;
    timezoneUpdated: (tz: string) => string;
    unknownParam: (param: string) => string;
    languageUpdated: (lang: string) => string;
    languageInvalid: (available: string) => string;
  };

  // Parse errors
  parse: {
    invalidVerseFormat: (input: string) => string;
    invalidDurationFormat: (input: string) => string;
    invalidRangeFormat: (input: string) => string;
    invalidImportLineFormat: (line: string) => string;
    invalidMonth: (month: string) => string;
    invalidDay: (day: string, month: string, max: number) => string;
    invalidPage: (page: number, max: number) => string;
    pageStartAfterEnd: (start: number, end: number) => string;
    invalidPageFormat: (input: string) => string;
    invalidFormat: (example: string) => string;
    invalidPageCount: (example: string) => string;
  };

  // Command usage examples (shown in error messages)
  examples: {
    session: string;
    read: string;
    extra: string;
    kahf: string;
    import: string;
  };

  // Session confirmation
  session: {
    recorded: string;
    extraRecorded: string;
    surahFallback: (num: number) => string;
    surah: string;
    verses: string;
    in: string;
    versesPerHour: (n: number) => string;
    pagesPerHour: (n: string) => string;
    from: string;
    to: string;
  };

  // Stats
  stats: {
    title: string;
    versesRead: string;
    totalDuration: string;
    averageSpeed: string;
    versesPerHour: string;
    versesPerHourShort: string;
    pagesPerHourShort: string;
    currentStreak: (days: number) => string;
    bestStreak: (days: number) => string;
    thisWeek: string;
    thisMonth: string;
    versesLabel: string;
    durationLabel: string;
    speedLabel: string;
    vsLastWeek: (pct: string) => string;
    noSession: string;
  };

  // Progress
  progress: {
    label: (read: number, total: number, pct: string) => string;
    lastPosition: (surahName: string, surahNum: number, ayah: number) => string;
    khatmas: (count: number) => string;
    page: string;
  };

  // Reminder
  reminder: {
    title: string;
    lastSession: (date: string, surahName: string, ayah: number) => string;
    thisWeek: (sessions: number, ayahs: number) => string;
    streak: (days: number) => string;
    keepItUp: string;
    timeToResume: string;
    noSession: string;
  };

  // Read confirmation
  read: {
    pageSingularRead: (page: number, duration: string) => string;
    pagePluralRead: (start: number, end: number, duration: string) => string;
    quranComplete: string;
    nextPage: (page: number) => string;
    remainingPages: (count: number, start: number, end: number) => string;
    pagesInvalid: string;
    formatInvalid: string;
  };

  // Kahf
  kahf: {
    pageRead: (page: number, total: number, duration: string) => string;
    thisWeek: (pages: number, total: number, duration: string) => string;
    complete: (page: number, total: number, duration: string) => string;
    lastWeek: (duration: string) => string;
    lastWeekFaster: (duration: string, diff: string) => string;
    lastWeekSlower: (duration: string, diff: string) => string;
    reminderBase: string;
    reminderLast: (date: string, duration: string) => string;
    alreadyComplete: string;
    remainingPages: (count: number, start: number, end: number) => string;
  };

  // Months
  months: string[];

  // Estimation
  estimation: {
    notEnoughData: string;
    monthsRemaining: (pace: string, months: number) => string;
    dateEstimate: (pace: string, day: number, month: string, year: number) => string;
  };

  // Khatma
  khatma: {
    first: string;
    nth: (n: number) => string;
  };

  // Surahs complete
  surahComplete: {
    singular: (name: string, num: number) => string;
    plural: (list: string) => string;
  };

  // Speed report
  speed: {
    title: string;
    globalAverage: (speed: number) => string;
    last7Days: (speed: number) => string;
    last30Days: (speed: number) => string;
    bestSession: (id: number, speed: number, date: string) => string;
    longestSession: (id: number, duration: string, date: string) => string;
    byType: string;
    typeNormal: string;
    typeExtra: string;
    typeKahf: string;
    sessionsCount: (count: number) => string;
  };

  // Weekly recap
  recap: {
    title: string;
    noSession: string;
    pagesRead: string;
    duration: string;
    sessions: string;
    streak: (days: number) => string;
  };

  // Timer
  timer: {
    startedNormalPage: string;
    startedNormalVerse: (input: string) => string;
    startedExtraPage: (page: string) => string;
    startedExtraVerse: (input: string) => string;
    startedKahf: string;
    alreadyActive: (duration: string) => string;
    noActiveTimer: string;
    cancelled: string;
    confirmLongTimer: (duration: string) => string;
    questionPages: (duration: string) => string;
    questionVerses: (duration: string) => string;
    questionKahfPages: (duration: string) => string;
    notFound: string;
    yes: string;
    no: string;
    stop: string;
    go: string;
    quranFinished: string;
    invalidPageCount: string;
    invalidVerseFormat: string;
    invalidGoFormat: string;
    invalidGoExtraFormat: string;
    overflowPages: (start: number, end: number, max: number) => string;
    internalError: string;
  };

  // Manage (delete/undo)
  manage: {
    confirm: string;
    cancel: string;
    deletePrompt: (id: number, desc: string) => string;
    noSessionToUndo: string;
    missingId: string;
    invalidId: (input: string) => string;
    sessionNotFound: (id: number) => string;
    sessionDeleted: (id: number, range: string, ayahs: number, duration: string) => string;
    sessionNotFoundShort: (id: number) => string;
    deletionCancelled: string;
  };

  // Import
  import: {
    noData: string;
    lineError: (lineNum: number, error: string) => string;
    success: (count: number) => string;
    successWithErrors: (count: number, errorCount: number, errors: string) => string;
    allFailed: (errorCount: number, errors: string) => string;
  };

  // Prayer handler
  prayer: {
    title: (city: string, country: string) => string;
    date: string;
    cacheRefreshed: string;
    fetchError: (error: string) => string;
  };

  // Debug
  debug: {
    configSection: string;
    prayerCacheSection: string;
    prayerCacheDateSection: (date: string) => string;
    lastSessionSection: string;
    cronSection: string;
    dbStatsSection: string;
    systemSection: string;
    sent: string;
    pending: string;
    noCache: string;
    noSession: string;
    statsError: string;
  };

  // Validation (quran.ts)
  validation: {
    surahNotFound: (num: number) => string;
    ayahOutOfRange: (surahNum: number, ayahCount: number, requested: number) => string;
    endBeforeStart: (endSurah: number, endAyah: number, startSurah: number, startAyah: number) => string;
  };

  // Prayer service (prayer.ts)
  prayerApi: {
    invalidResponse: string;
    missingField: (field: string) => string;
    httpError: (status: number) => string;
    apiError: (message: string) => string;
  };

  // Native language name for inline keyboard
  nativeName: string;
};
