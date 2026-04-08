import { arPlural } from "./plural";
import type { Locale } from "./types";

export const ar: Locale = {
  lang: "ar",

  commands: {
    start: "تشغيل البوت",
    help: "عرض المساعدة",
    session: "تسجيل جلسة قراءة",
    go: "بدء مؤقت القراءة",
    stop: "إيقاف المؤقت",
    read: "قراءة الصفحة التالية",
    extra: "تسجيل قراءة إضافية",
    kahf: "قراءة سورة الكهف (الجمعة)",
    import: "استيراد الجلسات",
    history: "سجل الجلسات",
    stats: "إحصائيات القراءة",
    progress: "التقدم في القرآن",
    undo: "التراجع عن آخر جلسة",
    delete: "حذف جلسة",
    edit: "تعديل مدة جلسة",
    speed: "سرعة القراءة",
    graph: "رسوم بيانية للقراءة (السرعة والصفحات)",
    config: "إعداد المدينة، البلد، المنطقة الزمنية، اللغة",
    prayer: "تحديث أوقات الصلاة",
  },

  welcomeHeader: "مرحبا بك في متتبع قراءة القرآن!",
  commandsAvailable: "الأوامر المتاحة:",

  error: "خطأ",
  example: "مثال",

  fmt: {
    dateShort: (day, month) => `${day}/${month}`,
    timeShort: (hour, minute) => `${hour}:${minute}`,
    versesPerHourCompact: (n) => `${n}آ/س`,
    pagesPerHourCompact: (n) => `${n}ص/س`,
    pagesCompact: (n) => `${n}ص`,
    hours: "س",
    minutes: "د",
    seconds: "ث",
  },

  config: {
    title: "-- الإعدادات --",
    cityLabel: "المدينة",
    countryLabel: "البلد",
    timezoneLabel: "المنطقة الزمنية",
    languageLabel: "اللغة",
    defaultSuffix: " (افتراضي)",
    missingValue: "قيمة مفقودة",
    cityUpdated: (city) =>
      `تم تحديث المدينة: ${city}\nتم مسح ذاكرة الصلاة المؤقتة.`,
    countryCodeInvalid: "رمز البلد يجب أن يكون حرفين (ISO)",
    countryUpdated: (country) =>
      `تم تحديث البلد: ${country}\nتم مسح ذاكرة الصلاة المؤقتة.`,
    timezoneInvalid: "منطقة زمنية غير صالحة",
    timezoneUpdated: (tz) => `تم تحديث المنطقة الزمنية: ${tz}`,
    unknownParam: (param) => `معامل غير معروف '${param}'`,
    languageUpdated: (lang) => `تم تحديث اللغة: ${lang}`,
    languageInvalid: (available) =>
      `لغة غير صالحة. اللغات المتاحة: ${available}`,
    languageError: "تعذر تحديث اللغة",
  },

  parse: {
    invalidVerseFormat: (input) => `صيغة آية غير صالحة '${input}'. استخدم 2:77`,
    invalidDurationFormat: (input) =>
      `صيغة مدة غير صالحة '${input}'. استخدم 8m أو 8m53`,
    invalidRangeFormat: (input) =>
      `صيغة نطاق غير صالحة '${input}'. استخدم 2:77-83 أو 2:280-3:10`,
    invalidImportLineFormat: (line) =>
      `صيغة سطر غير صالحة '${line}'. استخدم DD/MM, HHhMM - DURATION - RANGE`,
    invalidMonth: (month) => `شهر غير صالح '${month}' (1-12)`,
    invalidDay: (day, month, max) =>
      `يوم غير صالح '${day}' للشهر ${month} (1-${max})`,
    invalidPage: (page, max) =>
      `صفحة غير صالحة '${page}'. الصفحات من 1 إلى ${max}`,
    pageStartAfterEnd: (start, end) =>
      `صفحة البداية (${start}) يجب أن تكون أقل من أو تساوي صفحة النهاية (${end})`,
    invalidPageFormat: (input) =>
      `صيغة صفحة غير صالحة '${input}'. استخدم 300 أو 300-304`,
    invalidFormat: (example) => `صيغة غير صالحة. استخدم ${example}`,
    invalidPageCount: (example) => `عدد صفحات غير صالح. استخدم ${example}`,
  },

  examples: {
    session: "/session 2:77-83 8m53",
    read: "/read 5m أو /read 3 15m أو /read 3",
    extra: "/extra 300 5m أو /extra 2:77-83 8m أو /extra 300",
    kahf: "/kahf 5m أو /kahf 3 15m أو /kahf 3",
    import: "/import\n10/03, 13:30 - 8m53 - 2:77-83",
    edit: "/edit 42 15m",
  },

  session: {
    recorded: "تم تسجيل الجلسة:",
    extraRecorded: "تم تسجيل الجلسة الإضافية:",
    surahFallback: (num) => `سورة ${num}`,
    surah: "سورة",
    verses: "آيات",
    in: "في",
    versesPerHour: (n) => `${n} آية/س`,
    pagesPerHour: (n) => `${n} صفحة/س`,
    from: "آ.",
    to: "إلى",
    noDurationPrompt: "تسجيل بدون مؤقت؟",
    cancelled: "تم الإلغاء.",
    confirmationSameSurah: (
      surahName,
      ayahStart,
      ayahEnd,
      ayahCount,
      duration,
      speed
    ) =>
      `سورة ${surahName} آ.${ayahStart} إلى آ.${ayahEnd} -- ${ayahCount} آية في ${duration}${speed}`,
    confirmationCrossSurah: (
      startName,
      ayahStart,
      endName,
      ayahEnd,
      ayahCount,
      duration,
      speed
    ) =>
      `سورة ${startName} آ.${ayahStart} إلى سورة ${endName} آ.${ayahEnd} -- ${ayahCount} آية في ${duration}${speed}`,
    confirmationSameSurahNoDuration: (
      surahName,
      ayahStart,
      ayahEnd,
      ayahCount
    ) =>
      `سورة ${surahName} آ.${ayahStart} إلى آ.${ayahEnd} -- ${ayahCount} آية`,
    confirmationCrossSurahNoDuration: (
      startName,
      ayahStart,
      endName,
      ayahEnd,
      ayahCount
    ) =>
      `سورة ${startName} آ.${ayahStart} إلى سورة ${endName} آ.${ayahEnd} -- ${ayahCount} آية`,
    speedComparison: (pct) => `${pct} مقارنة بمتوسط 7 أيام`,
  },

  stats: {
    title: "-- الإحصائيات العامة --",
    versesRead: "الآيات المقروءة",
    totalDuration: "المدة الإجمالية",
    averageSpeed: "السرعة المتوسطة",
    versesPerHour: "آية/ساعة",
    versesPerHourShort: "آية/س",
    pagesPerHourShort: "صفحة/س",
    currentStreak: (days) =>
      `السلسلة الحالية: ${days} ${arPlural(days, { one: "يوم", two: "يومان", few: "أيام", many: "يومًا", other: "أيام" })}`,
    bestStreak: (days) =>
      `أفضل سلسلة: ${days} ${arPlural(days, { one: "يوم", two: "يومان", few: "أيام", many: "يومًا", other: "أيام" })}`,
    thisWeek: "-- هذا الأسبوع --",
    thisMonth: "-- هذا الشهر --",
    versesLabel: "الآيات",
    durationLabel: "المدة",
    speedLabel: "السرعة",
    vsLastWeek: (pct) => `${pct} مقارنة بالأسبوع الماضي`,
    noSession: "لا توجد جلسات مسجلة.",
  },

  progress: {
    label: (read, total, pct) => `التقدم: ${read} / ${total} آية (${pct}%)`,
    khatmas: (count) => `الختمات: ${count}`,
    page: "صفحة",
    khatmaTime: (duration) => `وقت القراءة (هذه الختمة): ${duration}`,
    remainingTime: (duration) => `الوقت المتبقي المقدر: ~${duration}`,
    noRecentData: "لا توجد بيانات حديثة",
    completionDate: (day, month, year) =>
      `تاريخ الانتهاء المتوقع: ${day} ${month} ${year}`,
  },

  reminder: {
    title: "تذكير بقراءة القرآن",
    nextPage: (page) => `الصفحة التالية: ${page}`,
    thisWeek: (sessions, ayahs) =>
      `هذا الأسبوع: ${sessions} ${arPlural(sessions, { one: "جلسة", two: "جلستان", few: "جلسات", many: "جلسة", other: "جلسات" })}، ${ayahs} آية`,
    streak: (days) =>
      `السلسلة: ${days} ${arPlural(days, { one: "يوم متتالي", two: "يومان متتاليان", few: "أيام متتالية", many: "يومًا متتاليًا", other: "أيام متتالية" })}`,
    streakAtRisk: (days) =>
      `سلسلتك من ${days} ${arPlural(days, { one: "يوم", two: "يومين", few: "أيام", many: "يومًا", other: "أيام" })} تنتهي الليلة إن لم تقرأ.`,
    streakLastChance: (days) =>
      `فرصة أخيرة للحفاظ على سلسلتك من ${days} ${arPlural(days, { one: "يوم", two: "يومين", few: "أيام", many: "يومًا", other: "أيام" })}.`,
    keepItUp: "استمر على هذا!",
    timeToResume: "حان وقت العودة للقراءة!",
  },

  read: {
    pageSingularRead: (page, duration) =>
      `تمت قراءة الصفحة ${page} في ${duration}`,
    pagePluralRead: (start, end, duration) =>
      `تمت قراءة الصفحات ${start}-${end} في ${duration}`,
    pageSingularRecorded: (page) => `الصفحة ${page}`,
    pagePluralRecorded: (start, end) => `الصفحات ${start}-${end}`,
    quranComplete: "اكتمل القرآن! الحمد لله!",
    nextPage: (page) => `الصفحة التالية: ${page}`,
    remainingPages: (count, start, end) =>
      `لم يتبق سوى ${count} صفحة (الصفحة ${start} إلى ${end})`,
    pagesInvalid: "صفحات غير صالحة",
    formatInvalid: "صيغة غير صالحة",
  },

  kahf: {
    pageRead: (page, total, duration) =>
      `تمت قراءة صفحة الكهف ${page}/${total} في ${duration}`,
    pageReadNoDuration: (page, total) => `صفحة الكهف ${page}/${total}`,
    thisWeek: (pages, total, duration) =>
      `هذا الأسبوع: ${pages}/${total} صفحة، ${duration} إجمالي`,
    complete: (page, total, duration) =>
      `اكتملت سورة الكهف! ${page}/${total} صفحة في ${duration}`,
    lastWeek: (duration) => `الأسبوع الماضي: ${duration}`,
    lastWeekFaster: (duration, diff) =>
      `الأسبوع الماضي: ${duration} (-${diff}، أحسنت!)`,
    lastWeekSlower: (duration, diff) =>
      `الأسبوع الماضي: ${duration} (+${diff})`,
    reminderBase: "تذكير: اليوم الجمعة! لا تنس قراءة سورة الكهف.",
    reminderLast: (date, duration) => `آخر قراءة: ${date} في ${duration}`,
    reminderNextPage: (page) => `الصفحة التالية: ${page}`,
    alreadyComplete: "سورة الكهف مكتملة هذا الأسبوع!",
    remainingPages: (count, start, end) =>
      `لم يتبق سوى ${count} صفحة من الكهف هذا الأسبوع (الصفحة ${start} إلى ${end})`,
  },

  months: [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ],

  graph: {
    title: (days) => `سرعة القراءة (${days} يوم)`,
    noData: "لا توجد بيانات قراءة لهذه الفترة.",
    dailyLabel: "يومي",
    trendLabel: "اتجاه 7 أيام",
    pagesTitle: (days) => `الصفحات يوميا (${days} يوم)`,
    pagesYAxis: "صفحات",
    error: "تعذر إنشاء الرسم البياني. حاول مرة أخرى لاحقا.",
  },

  history: {
    next: "التالي >>",
    prev: "<< السابق",
    pageIndicator: (current, total) => `صفحة ${current}/${total}`,
  },

  khatma: {
    first: "ختمة! أتممت قراءتك الأولى الكاملة للقرآن الكريم. الحمد لله!",
    nth: (n) => `ختمة! أتممت القراءة رقم ${n} للقرآن الكريم. الحمد لله!`,
  },

  surahComplete: {
    singular: (name, num) => `اكتملت سورة ${name} (${num})!`,
    plural: (list) => `السور المكتملة: ${list}`,
  },

  speed: {
    title: "-- سرعة القراءة --",
    globalAverage: (speed) => `المتوسط العام: ${speed} صفحة/س`,
    last7Days: (speed) => `متوسط آخر 7 أيام: ${speed} صفحة/س`,
    last30Days: (speed) => `متوسط آخر 30 يوم: ${speed} صفحة/س`,
    bestSession: (id, speed, date) =>
      `أفضل جلسة: #${id} (${speed} صفحة/س) - ${date}`,
    longestSession: (id, duration, date) =>
      `أطول جلسة: #${id} (${duration}) - ${date}`,
    byType: "حسب النوع:",
    typeNormal: "عادي",
    typeExtra: "إضافي",
    typeKahf: "الكهف",
    sessionsCount: (count) =>
      `${count} ${arPlural(count, { one: "جلسة", two: "جلستان", few: "جلسات", many: "جلسة", other: "جلسات" })}`,
  },

  recap: {
    title: "-- الملخص الأسبوعي --",
    noSession: "لا توجد جلسات هذا الأسبوع. حان وقت العودة للقراءة!",
    pagesRead: "الصفحات المقروءة",
    duration: "المدة",
    sessions: "الجلسات",
    streak: (days) =>
      `السلسلة: ${days} ${arPlural(days, { one: "يوم متتالي", two: "يومان متتاليان", few: "أيام متتالية", many: "يومًا متتاليًا", other: "أيام متتالية" })}`,
  },

  timer: {
    startedNormalPage: "بدأ المؤقت! قراءة عادية (صفحات).",
    startedNormalVerse: (input) => `بدأ المؤقت! القراءة من ${input}.`,
    startedExtraPage: (page) => `بدأ المؤقت! قراءة إضافية صفحة ${page}.`,
    startedExtraVerse: (input) => `بدأ المؤقت! قراءة إضافية من ${input}.`,
    startedKahf: "بدأ المؤقت! قراءة سورة الكهف.",
    alreadyActive: (duration) =>
      `يوجد مؤقت نشط منذ ${duration}. استخدم /stop لإيقافه`,
    noActiveTimer: "لا يوجد مؤقت نشط.",
    cancelled: "تم إلغاء المؤقت.",
    confirmLongTimer: (duration) =>
      `المؤقت يعمل منذ ${duration} (أكثر من 4 ساعات). تأكيد الإيقاف؟`,
    questionPages: (duration) => `توقفت الجلسة (${duration})\nكم صفحة قرأت؟`,
    questionVerses: (duration) =>
      `توقفت الجلسة (${duration})\nأين توقفت؟ (مثال: 2:83 أو 3:10)`,
    questionKahfPages: (duration) =>
      `توقفت الجلسة (${duration})\nكم صفحة من الكهف قرأت؟`,
    notFound: "المؤقت غير موجود.",
    yes: "نعم",
    no: "لا",
    stop: "إيقاف",
    go: "ابدأ",
    other: "اخر",
    quranFinished: "أتممت القرآن الكريم! الحمد لله!",
    invalidPageCount:
      "عدد صفحات غير صالح. أرسل رقما (مثال: 3) أو /stop cancel للإلغاء",
    invalidVerseFormat:
      "صيغة آية غير صالحة. أرسل مثلا 2:83 أو /stop cancel للإلغاء",
    invalidGoFormat:
      "صيغة غير صالحة\nمثال: /go أو /go 2:77 أو /go extra 300 أو /go kahf",
    invalidGoExtraFormat:
      "صيغة غير صالحة\nمثال: /go extra 300 أو /go extra 2:77",
    overflowPages: (start, end, max) =>
      `تجاوز: الصفحات ${start}-${end} (الحد الأقصى ${max})`,
    internalError: "خطأ داخلي أثناء معالجة الاستجابة",
  },

  edit: {
    missingArgs: "المعرف أو المدة مفقودان",
    invalidId: (input) => `معرف غير صالح '${input}'`,
    sessionNotFound: (id) => `الجلسة #${id} غير موجودة`,
    sessionEdited: (id, range, oldDuration, newDuration) =>
      `تم تعديل الجلسة #${id}.\n${range}\n${oldDuration} -> ${newDuration}`,
    durationAdded: (id, range, newDuration) =>
      `تمت إضافة المدة للجلسة #${id}.\n${range}\n-- -> ${newDuration}`,
  },

  manage: {
    confirm: "تأكيد",
    cancel: "إلغاء",
    deletePrompt: (id, desc) => `حذف الجلسة #${id} (${desc})؟`,
    noSessionToUndo: "لا توجد جلسة للتراجع عنها.",
    missingId: "المعرف مفقود",
    invalidId: (input) => `معرف غير صالح '${input}'`,
    sessionNotFound: (id) => `الجلسة #${id} غير موجودة`,
    sessionDeleted: (id, range, ayahs, duration) =>
      `تم حذف الجلسة #${id}.\n${range} -- ${ayahs} آية في ${duration}`,
    sessionNotFoundShort: (id) => `الجلسة #${id} غير موجودة.`,
    deletionCancelled: "تم إلغاء الحذف.",
  },

  import: {
    noData: "لا توجد بيانات للاستيراد",
    lineError: (lineNum, error) => `السطر ${lineNum}: ${error}`,
    success: (count) =>
      `تم استيراد ${count} ${arPlural(count, { one: "جلسة", two: "جلستان", few: "جلسات", many: "جلسة", other: "جلسات" })}.`,
    successWithErrors: (count, errorCount, errors) =>
      `تم استيراد ${count} ${arPlural(count, { one: "جلسة", two: "جلستان", few: "جلسات", many: "جلسة", other: "جلسات" })}، ${errorCount} ${arPlural(errorCount, { one: "خطأ", two: "خطآن", few: "أخطاء", many: "خطأً", other: "أخطاء" })}:\n${errors}`,
    allFailed: (errorCount, errors) =>
      `لم يتم استيراد أي جلسة. ${errorCount} ${arPlural(errorCount, { one: "خطأ", two: "خطآن", few: "أخطاء", many: "خطأً", other: "أخطاء" })}:\n${errors}`,
  },

  prayer: {
    title: (city, country) => `أوقات الصلاة - ${city}، ${country}`,
    date: "التاريخ",
    cacheRefreshed: "تم تحديث الذاكرة المؤقتة.",
    fetchError: (error) => `تعذر جلب أوقات الصلاة: ${error}`,
    fajr: "الفجر",
    dhuhr: "الظهر",
    asr: "العصر",
    maghrib: "المغرب",
    isha: "العشاء",
  },

  debug: {
    configSection: "-- الإعدادات --",
    prayerCacheSection: "-- ذاكرة الصلاة المؤقتة --",
    prayerCacheDateSection: (date) => `-- ذاكرة الصلاة المؤقتة (${date}) --`,
    lastSessionSection: "-- آخر جلسة --",
    cronSection: "-- Cron --",
    dbStatsSection: "-- إحصائيات قاعدة البيانات --",
    systemSection: "-- النظام --",
    sent: "مرسل",
    pending: "قيد الانتظار",
    noCache: "لا توجد ذاكرة مؤقتة",
    noSession: "لا توجد جلسة",
    statsError: "خطأ في الإحصائيات",
  },

  validation: {
    surahNotFound: (num) => `السورة ${num} غير موجودة (1-114)`,
    ayahOutOfRange: (surahNum, ayahCount, requested) =>
      `السورة ${surahNum} تحتوي على ${ayahCount} آية فقط (الآية ${requested} مطلوبة)`,
    endBeforeStart: (endSurah, endAyah, startSurah, startAyah) =>
      `النهاية (${endSurah}:${endAyah}) قبل البداية (${startSurah}:${startAyah})`,
  },

  prayerApi: {
    invalidResponse: "استجابة Aladhan غير صالحة",
    missingField: (field) => `حقل مفقود في استجابة Aladhan: ${field}`,
    httpError: (status) => `Aladhan API HTTP ${status}`,
    apiError: (message) => `خطأ Aladhan API: ${message}`,
  },

  milestone: {
    surahRemaining: (count, name) =>
      `${arPlural(count, {
        one: "آية واحدة متبقية",
        two: "آيتان متبقيتان",
        few: `${count} آيات متبقية`,
        many: `${count} آية متبقية`,
        other: `${count} آية متبقية`,
      })} لإتمام ${name}`,
    juzRemaining: (count, juz) =>
      `${arPlural(count, {
        one: "صفحة واحدة متبقية",
        two: "صفحتان متبقيتان",
        few: `${count} صفحات متبقية`,
        many: `${count} صفحة متبقية`,
        other: `${count} صفحة متبقية`,
      })} لإتمام الجزء ${juz}`,
    khatmaRemaining: (count) =>
      `${arPlural(count, {
        one: "صفحة واحدة متبقية",
        two: "صفحتان متبقيتان",
        few: `${count} صفحات متبقية`,
        many: `${count} صفحة متبقية`,
        other: `${count} صفحة متبقية`,
      })} لختم القرآن`,
  },

  nativeName: "العربية",
};
