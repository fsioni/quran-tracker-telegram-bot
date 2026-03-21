import type { Locale } from "./types";

export const fr: Locale = {
  commands: {
    start: "Demarrer le bot",
    help: "Afficher l'aide",
    session: "Enregistrer une session de lecture",
    go: "Demarrer un timer de lecture",
    stop: "Arreter le timer",
    read: "Lire la prochaine page",
    extra: "Enregistrer une lecture extra",
    kahf: "Lire sourate Al-Kahf (vendredi)",
    import: "Importer des sessions",
    history: "Historique des sessions",
    stats: "Statistiques de lecture",
    progress: "Progression dans le Coran",
    undo: "Annuler la derniere session",
    delete: "Supprimer une session",
    speed: "Vitesse de lecture",
    config: "Configurer ville, pays, fuseau horaire",
    prayer: "Rafraichir les horaires de priere",
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
  },

  config: {
    title: "-- Configuration --",
    cityLabel: "Ville",
    countryLabel: "Pays",
    timezoneLabel: "Fuseau horaire",
    languageLabel: "Langue",
    defaultSuffix: " (defaut)",
    missingValue: "valeur manquante",
    cityUpdated: (city) => `Ville mise a jour : ${city}\nCache des prieres reinitialise.`,
    countryCodeInvalid: "le code pays doit faire 2 lettres (ISO)",
    countryUpdated: (country) => `Pays mis a jour : ${country}\nCache des prieres reinitialise.`,
    timezoneInvalid: "fuseau horaire invalide",
    timezoneUpdated: (tz) => `Fuseau horaire mis a jour : ${tz}`,
    unknownParam: (param) => `parametre inconnu '${param}'`,
    languageUpdated: (lang) => `Langue mise a jour : ${lang}`,
    languageInvalid: (available) => `langue invalide. Langues disponibles : ${available}`,
  },

  parse: {
    invalidVerseFormat: (input) => `format de verset invalide '${input}'. Utilise 2:77`,
    invalidDurationFormat: (input) => `format de duree invalide '${input}'. Utilise 8m ou 8m53`,
    invalidRangeFormat: (input) => `format de plage invalide '${input}'. Utilise 2:77-83 ou 2:280-3:10`,
    invalidImportLineFormat: (line) => `format de ligne invalide '${line}'. Utilise JJ/MM, HHhMM - DUREE - RANGE`,
    invalidMonth: (month) => `mois invalide '${month}' (1-12)`,
    invalidDay: (day, month, max) => `jour invalide '${day}' pour le mois ${month} (1-${max})`,
    invalidPage: (page, max) => `page invalide '${page}'. Les pages vont de 1 a ${max}`,
    pageStartAfterEnd: (start, end) => `page de debut (${start}) doit etre inferieure ou egale a la page de fin (${end})`,
    invalidPageFormat: (input) => `format de page invalide '${input}'. Utilise 300 ou 300-304`,
    invalidFormat: (example) => `format invalide. Utilise ${example}`,
    invalidPageCount: (example) => `nombre de pages invalide. Utilise ${example}`,
  },

  examples: {
    session: "/session 2:77-83 8m53",
    read: "/read 5m ou /read 3 15m",
    extra: "/extra 300 5m ou /extra 2:77-83 8m",
    extraPage: "/extra 300 5m ou /extra 2:77-83 8m",
    kahf: "/kahf 5m ou /kahf 3 15m",
    import: "/import\n10/03, 13h30 - 8m53 - 2:77-83",
  },

  session: {
    recorded: "Session enregistree :",
    extraRecorded: "Session extra enregistree :",
    surahFallback: (num) => `Sourate ${num}`,
    surah: "sourate",
    verses: "versets",
    in: "en",
    versesPerHour: (n) => `${n} versets/h`,
    pagesPerHour: (n) => `${n} pages/h`,
    from: "v.",
    to: "a",
  },

  stats: {
    title: "-- Stats globales --",
    versesRead: "Versets lus",
    totalDuration: "Duree totale",
    averageSpeed: "Vitesse moyenne",
    versesPerHour: "versets/heure",
    versesPerHourShort: "versets/h",
    pagesPerHourShort: "pages/h",
    currentStreak: (days) => `Streak actuel : ${days} jours`,
    bestStreak: (days) => `Meilleur streak : ${days} jours`,
    thisWeek: "-- Cette semaine --",
    thisMonth: "-- Ce mois --",
    versesLabel: "Versets",
    durationLabel: "Duree",
    speedLabel: "Vitesse",
    vsLastWeek: (pct) => `${pct} vs semaine derniere`,
    noSession: "Aucune session enregistree.",
  },

  progress: {
    label: (read, total, pct) => `Progression : ${read} / ${total} versets (${pct}%)`,
    lastPosition: (surahName, surahNum, ayah) => `Dernier point : sourate ${surahName} (${surahNum}), verset ${ayah}`,
    khatmas: (count) => `Khatmas : ${count}`,
    page: "Page",
  },

  reminder: {
    title: "Rappel lecture du Coran",
    lastSession: (date, surahName, ayah) => `Derniere session : ${date} - sourate ${surahName} v.${ayah}`,
    thisWeek: (sessions, ayahs) => `Cette semaine : ${sessions} sessions, ${ayahs} versets`,
    streak: (days) => `Serie : ${days} jours consecutifs`,
    keepItUp: "Continue comme ca !",
    timeToResume: "C'est le moment de reprendre !",
    noSession: "Rappel lecture du Coran\n\nAucune session enregistree. Commence avec /session !",
  },

  read: {
    pageSingularRead: (page, duration) => `Page ${page} lue en ${duration}`,
    pagePluralRead: (start, end, duration) => `Pages ${start}-${end} lues en ${duration}`,
    quranComplete: "Coran termine ! Alhamdulillah !",
    nextPage: (page) => `Prochaine page : ${page}`,
    remainingPages: (count, start, end) => `il ne reste que ${count} page(s) (page ${start} a ${end})`,
    pagesInvalid: "pages invalides",
    formatInvalid: "format invalide",
  },

  kahf: {
    pageRead: (page, total, duration) => `Al-Kahf page ${page}/${total} lue en ${duration}`,
    thisWeek: (pages, total, duration) => `Cette semaine : ${pages}/${total} pages, ${duration} au total`,
    complete: (page, total, duration) => `Al-Kahf terminee ! ${page}/${total} pages en ${duration}`,
    lastWeek: (duration) => `Semaine derniere : ${duration}`,
    lastWeekFaster: (duration, diff) => `Semaine derniere : ${duration} (-${diff}, bravo !)`,
    lastWeekSlower: (duration, diff) => `Semaine derniere : ${duration} (+${diff})`,
    reminderBase: "Rappel : c'est vendredi ! Pense a lire sourate Al-Kahf.",
    reminderLast: (date, duration) => `Derniere lecture : ${date} en ${duration}`,
    alreadyComplete: "Al-Kahf deja terminee cette semaine !",
    remainingPages: (count, start, end) => `il ne reste que ${count} page(s) d'Al-Kahf cette semaine (page ${start} a ${end})`,
  },

  months: [
    "janvier", "fevrier", "mars", "avril", "mai", "juin",
    "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
  ],

  estimation: {
    notEnoughData: "Pas assez de donnees recentes pour estimer (lis regulierement pour voir une projection)",
    monthsRemaining: (pace, months) => `A ton rythme actuel (~${pace} pages/jour), il te reste environ ${months} mois`,
    dateEstimate: (pace, day, month, year) => `A ce rythme (~${pace} pages/jour), tu finiras vers le ${day} ${month} ${year}`,
  },

  khatma: {
    first: "Khatma ! Tu as termine ta premiere lecture complete du Coran. Alhamdulillah !",
    nth: (n) => `Khatma ! Tu as termine ta ${n}e lecture complete du Coran. Alhamdulillah !`,
  },

  surahComplete: {
    singular: (name, num) => `Sourate ${name} (${num}) terminee !`,
    plural: (list) => `Sourates terminees : ${list}`,
  },

  speed: {
    title: "-- Vitesse de lecture --",
    globalAverage: (speed) => `Moyenne globale : ${speed} versets/h`,
    last7Days: (speed) => `Moyenne 7 derniers jours : ${speed} versets/h`,
    last30Days: (speed) => `Moyenne 30 derniers jours : ${speed} versets/h`,
    bestSession: (id, speed, date) => `Meilleure session : #${id} (${speed} versets/h) - ${date}`,
    longestSession: (id, duration, date) => `Plus longue session : #${id} (${duration}) - ${date}`,
    byType: "Par type :",
    typeNormal: "Normal",
    typeExtra: "Extra",
    typeKahf: "Kahf",
    sessionsCount: (count) => `${count} sessions`,
  },

  recap: {
    title: "-- Recap hebdomadaire --",
    noSession: "Aucune session cette semaine. C'est le moment de reprendre !",
    pagesRead: "Pages lues",
    duration: "Duree",
    sessions: "Sessions",
    streak: (days) => `Streak : ${days} jours consecutifs`,
  },

  timer: {
    startedNormalPage: "Timer demarre ! Lecture normale (pages).",
    startedNormalVerse: (input) => `Timer demarre ! Lecture depuis ${input}.`,
    startedExtraPage: (page) => `Timer demarre ! Lecture extra page ${page}.`,
    startedExtraVerse: (input) => `Timer demarre ! Lecture extra depuis ${input}.`,
    startedKahf: "Timer demarre ! Lecture d'Al-Kahf.",
    alreadyActive: (duration) => `un timer est deja actif depuis ${duration}. Utilise /stop pour l'arreter`,
    noActiveTimer: "Aucun timer actif.",
    cancelled: "Timer annule.",
    confirmLongTimer: (duration) => `Le timer tourne depuis ${duration} (plus de 4h). Confirmer l'arret ?`,
    questionPages: (duration) => `Session arretee (${duration})\nCombien de pages as-tu lues ?`,
    questionVerses: (duration) => `Session arretee (${duration})\nJusqu'ou as-tu lu ? (ex: 2:83 ou 3:10)`,
    questionKahfPages: (duration) => `Session arretee (${duration})\nCombien de pages d'Al-Kahf as-tu lues ?`,
    notFound: "Timer introuvable.",
    yes: "Oui",
    no: "Non",
    stop: "Stop",
    go: "Go",
    quranFinished: "Tu as termine le Coran ! Alhamdulillah !",
    invalidPageCount: "nombre de pages invalide. Envoie un nombre (ex: 3) ou /stop cancel pour annuler",
    invalidVerseFormat: "format de verset invalide. Envoie ex: 2:83 ou /stop cancel pour annuler",
    invalidGoFormat: "format invalide\nExemple : /go ou /go 2:77 ou /go extra 300 ou /go kahf",
    invalidGoExtraFormat: "format invalide\nExemple : /go extra 300 ou /go extra 2:77",
    overflowPages: (start, end, max) => `depassement: pages ${start}-${end} (max ${max})`,
    internalError: "erreur interne lors du traitement de la reponse",
  },

  manage: {
    confirm: "Confirmer",
    cancel: "Annuler",
    deletePrompt: (id, desc) => `Supprimer la session #${id} (${desc}) ?`,
    noSessionToUndo: "Aucune session a annuler.",
    missingId: "ID manquant",
    invalidId: (input) => `ID invalide '${input}'`,
    sessionNotFound: (id) => `la session #${id} n'existe pas`,
    sessionDeleted: (id, range, ayahs, duration) => `Session #${id} supprimee.\n${range} -- ${ayahs} versets en ${duration}`,
    sessionNotFoundShort: (id) => `Session #${id} introuvable.`,
    deletionCancelled: "Suppression annulee.",
  },

  import: {
    noData: "aucune donnee a importer",
    lineError: (lineNum, error) => `Ligne ${lineNum} : ${error}`,
    success: (count) => `${count} session${count > 1 ? "s" : ""} importee${count > 1 ? "s" : ""}.`,
    successWithErrors: (count, errorCount, errors) =>
      `${count} session${count > 1 ? "s" : ""} importee${count > 1 ? "s" : ""}, ${errorCount} erreur${errorCount > 1 ? "s" : ""} :\n${errors}`,
    allFailed: (errorCount, errors) =>
      `Aucune session importee. ${errorCount} erreur${errorCount > 1 ? "s" : ""} :\n${errors}`,
  },

  prayer: {
    title: (city, country) => `Horaires de priere - ${city}, ${country}`,
    date: "Date",
    cacheRefreshed: "Cache rafraichi.",
    fetchError: (error) => `impossible de recuperer les horaires : ${error}`,
  },

  debug: {
    configSection: "-- Config --",
    prayerCacheSection: "-- Cache priere --",
    prayerCacheDateSection: (date) => `-- Cache priere (${date}) --`,
    lastSessionSection: "-- Derniere session --",
    cronSection: "-- Cron --",
    dbStatsSection: "-- DB stats --",
    systemSection: "-- Systeme --",
    sent: "envoye",
    pending: "en attente",
    noCache: "aucun cache",
    noSession: "aucune session",
    statsError: "erreur stats",
  },

  validation: {
    surahNotFound: (num) => `la sourate ${num} n'existe pas (1-114)`,
    ayahOutOfRange: (surahNum, ayahCount, requested) =>
      `la sourate ${surahNum} n'a que ${ayahCount} versets (verset ${requested} demande)`,
    endBeforeStart: (endSurah, endAyah, startSurah, startAyah) =>
      `la fin (${endSurah}:${endAyah}) precede le debut (${startSurah}:${startAyah})`,
  },

  prayerApi: {
    invalidResponse: "Reponse Aladhan invalide",
    missingField: (field) => `Champ manquant dans la reponse Aladhan: ${field}`,
    httpError: (status) => `Aladhan API HTTP ${status}`,
    apiError: (message) => `Aladhan API erreur: ${message}`,
  },
};
