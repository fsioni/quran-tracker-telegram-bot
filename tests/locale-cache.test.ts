import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "../src/locales/en";
import { fr } from "../src/locales/fr";

// Mock the db module before importing localeCache
const mockGetConfig = vi.fn();
vi.mock("../src/services/db/config", () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
}));

import {
  invalidateLocaleCache,
  resolveLocale,
} from "../src/services/locale-cache";

const fakeDb = {} as D1Database;

describe("resolveLocale", () => {
  beforeEach(() => {
    invalidateLocaleCache();
    mockGetConfig.mockReset();
  });

  it("returns language from DB when set", async () => {
    mockGetConfig.mockResolvedValue("fr");
    const locale = await resolveLocale(fakeDb);
    expect(locale).toBe(fr);
  });

  it("uses Telegram language_code as fallback when DB has no language", async () => {
    mockGetConfig.mockResolvedValue(null);
    const locale = await resolveLocale(fakeDb, "fr");
    expect(locale).toBe(fr);
  });

  it("extracts 2-letter prefix from Telegram language_code", async () => {
    mockGetConfig.mockResolvedValue(null);
    const locale = await resolveLocale(fakeDb, "fr-FR");
    expect(locale).toBe(fr);
  });

  it("defaults to English when no DB language and no Telegram code", async () => {
    mockGetConfig.mockResolvedValue(null);
    const locale = await resolveLocale(fakeDb);
    expect(locale).toBe(en);
  });

  it("defaults to English when Telegram code is unsupported", async () => {
    mockGetConfig.mockResolvedValue(null);
    const locale = await resolveLocale(fakeDb, "de");
    expect(locale).toBe(en);
  });

  it("DB language takes precedence over Telegram code", async () => {
    mockGetConfig.mockResolvedValue("en");
    const locale = await resolveLocale(fakeDb, "fr");
    expect(locale).toBe(en);
  });

  it("second call uses cache and skips DB query", async () => {
    mockGetConfig.mockResolvedValue("fr");
    await resolveLocale(fakeDb);
    expect(mockGetConfig).toHaveBeenCalledTimes(1);

    mockGetConfig.mockClear();
    const second = await resolveLocale(fakeDb);
    expect(mockGetConfig).not.toHaveBeenCalled();
    expect(second).toBe(fr);
  });

  it("invalidateLocaleCache forces re-query on next call", async () => {
    mockGetConfig.mockResolvedValue("fr");
    await resolveLocale(fakeDb);

    invalidateLocaleCache();
    mockGetConfig.mockResolvedValue("en");
    const locale = await resolveLocale(fakeDb);
    expect(mockGetConfig).toHaveBeenCalled();
    expect(locale).toBe(en);
  });
});
