import type { Locale } from "./types";

export const fr: Locale = {
  lang: "fr",

  commands: {
    start: "Démarrer le bot",
    help: "Afficher l'aide",
    session: "Enregistrer une session de lecture",
    go: "Démarrer un timer de lecture",
    stop: "Arrêter le timer",
    read: "Lire la prochaine page",
    extra: "Enregistrer une lecture extra",
    kahf: "Lire sourate Al-Kahf (vendredi)",
    import: "Importer des sessions",
    history: "Historique des sessions",
    stats: "Statistiques de lecture",
    progress: "Progression dans le Coran",
    undo: "Annuler la dernière session",
    delete: "Supprimer une session",
    edit: "Modifier la durée d'une session",
    speed: "Vitesse de lecture",
    graph: "Graphiques de lecture (vitesse & pages)",
    config: "Configurer ville, pays, fuseau horaire, langue",
    prayer: "Rafraîchir les horaires de prière",
  },

  welcomeHeader: "Bienvenue sur le Quran Reading Tracker !",
  commandsAvailable: "Commandes disponibles :",

  error: "Erreur",
  example: "Exemple",

  fmt: {
    dateShort: (day, month) => `${day}/${month}`,
    timeShort: (hour, minute) => `${hour}h${minute}`,
    versesPerHourCompact: (n) => `${n}v/h`,
    pagesPerHourCompact: (n) => `${n}p/h`,
    pagesCompact: (n) => `${n}p`,
    hours: "h",
    minutes: "m",
    seconds: "s",
  },

  config: {
    title: "-- Configuration --",
    cityLabel: "Ville",
    countryLabel: "Pays",
    timezoneLabel: "Fuseau horaire",
    languageLabel: "Langue",
    defaultSuffix: " (défaut)",
    missingValue: "valeur manquante",
    cityUpdated: (city) =>
      `Ville mise à jour : ${city}\nCache des prières réinitialisé.`,
    countryCodeInvalid: "le code pays doit faire 2 lettres (ISO)",
    countryUpdated: (country) =>
      `Pays mis à jour : ${country}\nCache des prières réinitialisé.`,
    timezoneInvalid: "fuseau horaire invalide",
    timezoneUpdated: (tz) => `Fuseau horaire mis à jour : ${tz}`,
    unknownParam: (param) => `paramètre inconnu '${param}'`,
    languageUpdated: (lang) => `Langue mise à jour : ${lang}`,
    languageInvalid: (available) =>
      `langue invalide. Langues disponibles : ${available}`,
    languageError: "impossible de mettre à jour la langue",
  },

  parse: {
    invalidVerseFormat: (input) =>
      `format de verset invalide '${input}'. Utilise 2:77`,
    invalidDurationFormat: (input) =>
      `format de durée invalide '${input}'. Utilise 8m ou 8m53`,
    invalidRangeFormat: (input) =>
      `format de plage invalide '${input}'. Utilise 2:77-83 ou 2:280-3:10`,
    invalidImportLineFormat: (line) =>
      `format de ligne invalide '${line}'. Utilise JJ/MM, HHhMM - DURÉE - RANGE`,
    invalidMonth: (month) => `mois invalide '${month}' (1-12)`,
    invalidDay: (day, month, max) =>
      `jour invalide '${day}' pour le mois ${month} (1-${max})`,
    invalidPage: (page, max) =>
      `page invalide '${page}'. Les pages vont de 1 à ${max}`,
    pageStartAfterEnd: (start, end) =>
      `page de début (${start}) doit être inférieure ou égale à la page de fin (${end})`,
    invalidPageFormat: (input) =>
      `format de page invalide '${input}'. Utilise 300 ou 300-304`,
    invalidFormat: (example) => `format invalide. Utilise ${example}`,
    invalidPageCount: (example) =>
      `nombre de pages invalide. Utilise ${example}`,
  },

  examples: {
    session: "/session 2:77-83 8m53",
    read: "/read 5m ou /read 3 15m ou /read 3",
    extra: "/extra 300 5m ou /extra 2:77-83 8m ou /extra 300",
    kahf: "/kahf 5m ou /kahf 3 15m ou /kahf 3",
    import: "/import\n10/03, 13h30 - 8m53 - 2:77-83",
    edit: "/edit 42 15m",
  },

  session: {
    recorded: "Session enregistrée :",
    extraRecorded: "Session extra enregistrée :",
    surahFallback: (num) => `Sourate ${num}`,
    surah: "sourate",
    verses: "versets",
    in: "en",
    versesPerHour: (n) => `${n} versets/h`,
    pagesPerHour: (n) => `${n} pages/h`,
    from: "v.",
    to: "à",
    noDurationPrompt: "Enregistrer sans timer ?",
    cancelled: "Annulé.",
    confirmationSameSurah: (
      surahName,
      ayahStart,
      ayahEnd,
      ayahCount,
      duration,
      speed
    ) =>
      `sourate ${surahName} v.${ayahStart} à v.${ayahEnd} -- ${ayahCount} versets en ${duration}${speed}`,
    confirmationCrossSurah: (
      startName,
      ayahStart,
      endName,
      ayahEnd,
      ayahCount,
      duration,
      speed
    ) =>
      `sourate ${startName} v.${ayahStart} à sourate ${endName} v.${ayahEnd} -- ${ayahCount} versets en ${duration}${speed}`,
    confirmationSameSurahNoDuration: (
      surahName,
      ayahStart,
      ayahEnd,
      ayahCount
    ) =>
      `sourate ${surahName} v.${ayahStart} à v.${ayahEnd} -- ${ayahCount} versets`,
    confirmationCrossSurahNoDuration: (
      startName,
      ayahStart,
      endName,
      ayahEnd,
      ayahCount
    ) =>
      `sourate ${startName} v.${ayahStart} à sourate ${endName} v.${ayahEnd} -- ${ayahCount} versets`,
  },

  stats: {
    title: "-- Stats globales --",
    versesRead: "Versets lus",
    totalDuration: "Durée totale",
    averageSpeed: "Vitesse moyenne",
    versesPerHour: "versets/heure",
    versesPerHourShort: "versets/h",
    pagesPerHourShort: "pages/h",
    currentStreak: (days) =>
      `Streak actuel : ${days} ${days <= 1 ? "jour" : "jours"}`,
    bestStreak: (days) =>
      `Meilleur streak : ${days} ${days <= 1 ? "jour" : "jours"}`,
    thisWeek: "-- Cette semaine --",
    thisMonth: "-- Ce mois --",
    versesLabel: "Versets",
    durationLabel: "Durée",
    speedLabel: "Vitesse",
    vsLastWeek: (pct) => `${pct} vs semaine dernière`,
    noSession: "Aucune session enregistrée.",
  },

  progress: {
    label: (read, total, pct) =>
      `Progression : ${read} / ${total} versets (${pct}%)`,
    khatmas: (count) => `Khatmas : ${count}`,
    page: "Page",
  },

  reminder: {
    title: "Rappel lecture du Coran",
    nextPage: (page) => `Prochaine page : ${page}`,
    thisWeek: (sessions, ayahs) =>
      `Cette semaine : ${sessions} ${sessions <= 1 ? "session" : "sessions"}, ${ayahs} versets`,
    streak: (days) =>
      `Série : ${days} ${days <= 1 ? "jour consécutif" : "jours consécutifs"}`,
    keepItUp: "Continue comme ça !",
    timeToResume: "C'est le moment de reprendre !",
  },

  read: {
    pageSingularRead: (page, duration) => `Page ${page} lue en ${duration}`,
    pagePluralRead: (start, end, duration) =>
      `Pages ${start}-${end} lues en ${duration}`,
    pageSingularRecorded: (page) => `Page ${page} enregistree`,
    pagePluralRecorded: (start, end) => `Pages ${start}-${end} enregistrees`,
    quranComplete: "Coran terminé ! Alhamdulillah !",
    nextPage: (page) => `Prochaine page : ${page}`,
    remainingPages: (count, start, end) =>
      `il ne reste que ${count} page(s) (page ${start} à ${end})`,
    pagesInvalid: "pages invalides",
    formatInvalid: "format invalide",
  },

  kahf: {
    pageRead: (page, total, duration) =>
      `Al-Kahf page ${page}/${total} lue en ${duration}`,
    pageReadNoDuration: (page, total) =>
      `Al-Kahf page ${page}/${total} enregistree`,
    thisWeek: (pages, total, duration) =>
      `Cette semaine : ${pages}/${total} pages, ${duration} au total`,
    complete: (page, total, duration) =>
      `Al-Kahf terminée ! ${page}/${total} pages en ${duration}`,
    lastWeek: (duration) => `Semaine dernière : ${duration}`,
    lastWeekFaster: (duration, diff) =>
      `Semaine dernière : ${duration} (-${diff}, bravo !)`,
    lastWeekSlower: (duration, diff) =>
      `Semaine dernière : ${duration} (+${diff})`,
    reminderBase: "Rappel : c'est vendredi ! Pense à lire sourate Al-Kahf.",
    reminderLast: (date, duration) =>
      `Dernière lecture : ${date} en ${duration}`,
    reminderNextPage: (page) => `Prochaine page : ${page}`,
    alreadyComplete: "Al-Kahf déjà terminée cette semaine !",
    remainingPages: (count, start, end) =>
      `il ne reste que ${count} page(s) d'Al-Kahf cette semaine (page ${start} à ${end})`,
  },

  months: [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ],

  graph: {
    title: (days) => `Vitesse de lecture (${days} jours)`,
    noData: "Aucune donnée de lecture pour cette période.",
    dailyLabel: "Quotidien",
    trendLabel: "Tendance 7j",
    pagesTitle: (days) => `Pages par jour (${days} jours)`,
    pagesYAxis: "pages",
    error: "Impossible de générer le graphique. Réessaie plus tard.",
  },

  history: {
    next: "Suivant >>",
    prev: "<< Précédent",
    pageIndicator: (current, total) => `Page ${current}/${total}`,
  },

  estimation: {
    notEnoughData:
      "Pas assez de données récentes pour estimer (lis régulièrement pour voir une projection)",
    monthsRemaining: (pace, months) =>
      `À ton rythme actuel (~${pace} pages/jour), il te reste environ ${months} mois`,
    dateEstimate: (pace, day, month, year) =>
      `À ce rythme (~${pace} pages/jour), tu finiras vers le ${day} ${month} ${year}`,
  },

  khatma: {
    first:
      "Khatma ! Tu as terminé ta première lecture complète du Coran. Alhamdulillah !",
    nth: (n) =>
      `Khatma ! Tu as terminé ta ${n === 1 ? "1re" : `${n}e`} lecture complète du Coran. Alhamdulillah !`,
  },

  surahComplete: {
    singular: (name, num) => `Sourate ${name} (${num}) terminée !`,
    plural: (list) => `Sourates terminées : ${list}`,
  },

  speed: {
    title: "-- Vitesse de lecture --",
    globalAverage: (speed) => `Moyenne globale : ${speed} pages/h`,
    last7Days: (speed) => `Moyenne 7 derniers jours : ${speed} pages/h`,
    last30Days: (speed) => `Moyenne 30 derniers jours : ${speed} pages/h`,
    bestSession: (id, speed, date) =>
      `Meilleure session : #${id} (${speed} pages/h) - ${date}`,
    longestSession: (id, duration, date) =>
      `Plus longue session : #${id} (${duration}) - ${date}`,
    byType: "Par type :",
    typeNormal: "Normal",
    typeExtra: "Extra",
    typeKahf: "Kahf",
    sessionsCount: (count) => `${count} ${count <= 1 ? "session" : "sessions"}`,
  },

  recap: {
    title: "-- Récap hebdomadaire --",
    noSession: "Aucune session cette semaine. C'est le moment de reprendre !",
    pagesRead: "Pages lues",
    duration: "Durée",
    sessions: "Sessions",
    streak: (days) =>
      `Streak : ${days} ${days <= 1 ? "jour consécutif" : "jours consécutifs"}`,
  },

  timer: {
    startedNormalPage: "Timer démarré ! Lecture normale (pages).",
    startedNormalVerse: (input) => `Timer démarré ! Lecture depuis ${input}.`,
    startedExtraPage: (page) => `Timer démarré ! Lecture extra page ${page}.`,
    startedExtraVerse: (input) =>
      `Timer démarré ! Lecture extra depuis ${input}.`,
    startedKahf: "Timer démarré ! Lecture d'Al-Kahf.",
    alreadyActive: (duration) =>
      `un timer est déjà actif depuis ${duration}. Utilise /stop pour l'arrêter`,
    noActiveTimer: "Aucun timer actif.",
    cancelled: "Timer annulé.",
    confirmLongTimer: (duration) =>
      `Le timer tourne depuis ${duration} (plus de 4h). Confirmer l'arrêt ?`,
    questionPages: (duration) =>
      `Session arrêtée (${duration})\nCombien de pages as-tu lues ?`,
    questionVerses: (duration) =>
      `Session arrêtée (${duration})\nJusqu'où as-tu lu ? (ex: 2:83 ou 3:10)`,
    questionKahfPages: (duration) =>
      `Session arrêtée (${duration})\nCombien de pages d'Al-Kahf as-tu lues ?`,
    notFound: "Timer introuvable.",
    yes: "Oui",
    no: "Non",
    stop: "Stop",
    go: "Go",
    other: "Autre",
    quranFinished: "Tu as terminé le Coran ! Alhamdulillah !",
    invalidPageCount:
      "nombre de pages invalide. Envoie un nombre (ex: 3) ou /stop cancel pour annuler",
    invalidVerseFormat:
      "format de verset invalide. Envoie ex: 2:83 ou /stop cancel pour annuler",
    invalidGoFormat:
      "format invalide\nExemple : /go ou /go 2:77 ou /go extra 300 ou /go kahf",
    invalidGoExtraFormat:
      "format invalide\nExemple : /go extra 300 ou /go extra 2:77",
    overflowPages: (start, end, max) =>
      `dépassement: pages ${start}-${end} (max ${max})`,
    internalError: "erreur interne lors du traitement de la réponse",
  },

  edit: {
    missingArgs: "ID ou durée manquants",
    invalidId: (input) => `ID invalide '${input}'`,
    sessionNotFound: (id) => `la session #${id} n'existe pas`,
    sessionEdited: (id, range, oldDuration, newDuration) =>
      `Session #${id} modifiée.\n${range}\n${oldDuration} -> ${newDuration}`,
    durationAdded: (id, range, newDuration) =>
      `Durée ajoutée à la session #${id}.\n${range}\n-- -> ${newDuration}`,
  },

  manage: {
    confirm: "Confirmer",
    cancel: "Annuler",
    deletePrompt: (id, desc) => `Supprimer la session #${id} (${desc}) ?`,
    noSessionToUndo: "Aucune session à annuler.",
    missingId: "ID manquant",
    invalidId: (input) => `ID invalide '${input}'`,
    sessionNotFound: (id) => `la session #${id} n'existe pas`,
    sessionDeleted: (id, range, ayahs, duration) =>
      `Session #${id} supprimée.\n${range} -- ${ayahs} versets en ${duration}`,
    sessionNotFoundShort: (id) => `Session #${id} introuvable.`,
    deletionCancelled: "Suppression annulée.",
  },

  import: {
    noData: "aucune donnée à importer",
    lineError: (lineNum, error) => `Ligne ${lineNum} : ${error}`,
    success: (count) =>
      `${count} session${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}.`,
    successWithErrors: (count, errorCount, errors) =>
      `${count} session${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}, ${errorCount} erreur${errorCount > 1 ? "s" : ""} :\n${errors}`,
    allFailed: (errorCount, errors) =>
      `Aucune session importée. ${errorCount} erreur${errorCount > 1 ? "s" : ""} :\n${errors}`,
  },

  prayer: {
    title: (city, country) => `Horaires de prière - ${city}, ${country}`,
    date: "Date",
    cacheRefreshed: "Cache rafraîchi.",
    fetchError: (error) => `impossible de récupérer les horaires : ${error}`,
    fajr: "Fajr",
    dhuhr: "Dhouhr",
    asr: "Asr",
    maghrib: "Maghreb",
    isha: "Isha",
  },

  debug: {
    configSection: "-- Config --",
    prayerCacheSection: "-- Cache prière --",
    prayerCacheDateSection: (date) => `-- Cache prière (${date}) --`,
    lastSessionSection: "-- Dernière session --",
    cronSection: "-- Cron --",
    dbStatsSection: "-- DB stats --",
    systemSection: "-- Système --",
    sent: "envoyé",
    pending: "en attente",
    noCache: "aucun cache",
    noSession: "aucune session",
    statsError: "erreur stats",
  },

  validation: {
    surahNotFound: (num) => `la sourate ${num} n'existe pas (1-114)`,
    ayahOutOfRange: (surahNum, ayahCount, requested) =>
      `la sourate ${surahNum} n'a que ${ayahCount} versets (verset ${requested} demandé)`,
    endBeforeStart: (endSurah, endAyah, startSurah, startAyah) =>
      `la fin (${endSurah}:${endAyah}) précède le début (${startSurah}:${startAyah})`,
  },

  prayerApi: {
    invalidResponse: "Réponse Aladhan invalide",
    missingField: (field) => `Champ manquant dans la réponse Aladhan: ${field}`,
    httpError: (status) => `Aladhan API HTTP ${status}`,
    apiError: (message) => `Aladhan API erreur: ${message}`,
  },

  nativeName: "Français",
};
