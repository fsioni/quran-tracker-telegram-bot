import type { Locale } from "./types";
import { fr } from "./fr";
import { en } from "./en";

export type { Locale } from "./types";
export { fr } from "./fr";
export { en } from "./en";

export type Language = "en" | "fr";

export const LANGUAGES: Language[] = ["en", "fr"];

const locales: Record<Language, Locale> = { en, fr };

export function getLocale(lang: string | null): Locale {
  if (lang && Object.prototype.hasOwnProperty.call(locales, lang)) {
    return locales[lang as Language];
  }
  return en;
}

// Single source of truth for all bot commands (order = Telegram menu order).
const BOT_COMMANDS: (keyof Locale["commands"])[] = [
  "start", "help", "session", "go", "stop", "read", "extra", "kahf",
  "import", "history", "stats", "progress", "undo", "delete", "speed",
  "config", "prayer",
];

const WELCOME_EXCLUDED = new Set<string>(["start"]);

export function getBotCommands(t: Locale): { command: string; description: string }[] {
  return BOT_COMMANDS.map((cmd) => ({ command: cmd, description: t.commands[cmd] }));
}

export function buildWelcome(t: Locale): string {
  const lines = BOT_COMMANDS
    .filter((cmd) => !WELCOME_EXCLUDED.has(cmd))
    .map((cmd) => `/${cmd} - ${t.commands[cmd]}`);
  return `${t.welcomeHeader}\n\n${t.commandsAvailable}\n${lines.join("\n")}`;
}
