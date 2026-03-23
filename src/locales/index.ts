import { ar } from "./ar";
import { en } from "./en";
import { fr } from "./fr";
import type { Locale } from "./types";

export { ar } from "./ar";
export { en } from "./en";
export { fr } from "./fr";
export type { Locale } from "./types";

export type Language = "en" | "fr" | "ar";

export const LANGUAGES: Language[] = ["en", "fr", "ar"];

export const CALLBACK_LANG_SET = "lang_set";
export const CALLBACK_LANG_SET_RE = /^lang_set:(.+)$/;

const locales: Record<Language, Locale> = { en, fr, ar };

export function getLocale(lang: string | null): Locale {
  if (lang && Object.hasOwn(locales, lang)) {
    return locales[lang as Language];
  }
  return en;
}

// Single source of truth for all bot commands (order = Telegram menu order).
const BOT_COMMANDS: (keyof Locale["commands"])[] = [
  "start",
  "help",
  "session",
  "go",
  "stop",
  "read",
  "extra",
  "kahf",
  "import",
  "history",
  "stats",
  "progress",
  "undo",
  "delete",
  "speed",
  "config",
  "prayer",
];

const WELCOME_EXCLUDED = new Set<string>(["start"]);

export function getBotCommands(
  t: Locale
): { command: string; description: string }[] {
  return BOT_COMMANDS.map((cmd) => ({
    command: cmd,
    description: t.commands[cmd],
  }));
}

export function buildWelcome(t: Locale): string {
  const lines = BOT_COMMANDS.filter((cmd) => !WELCOME_EXCLUDED.has(cmd)).map(
    (cmd) => `/${cmd} - ${t.commands[cmd]}`
  );
  return `${t.welcomeHeader}\n\n${t.commandsAvailable}\n${lines.join("\n")}`;
}
