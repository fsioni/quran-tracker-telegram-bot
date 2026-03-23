import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomContext } from "../../src/bot";
import { buildWelcome, getBotCommands } from "../../src/locales";
import { en } from "../../src/locales/en";
import { fr } from "../../src/locales/fr";

vi.mock("../../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/db")>();
  return {
    ...actual,
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    clearPrayerCache: vi.fn(),
  };
});

vi.mock("../../src/services/locale-cache", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/locale-cache")>();
  return {
    ...actual,
    invalidateLocaleCache: vi.fn(),
  };
});

import {
  configHandler,
  helpHandler,
  langSetCallback,
  startHandler,
} from "../../src/handlers/config";
import { clearPrayerCache, getConfig, setConfig } from "../../src/services/db";
import { invalidateLocaleCache } from "../../src/services/locale-cache";

function createMockContext(chatId = 12_345): CustomContext {
  return {
    reply: vi.fn().mockResolvedValue(undefined),
    chat: { id: chatId },
    db: {} as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

function makeConfigCtx(match = ""): CustomContext {
  return {
    reply: vi.fn().mockResolvedValue(undefined),
    match,
    db: {} as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

describe("startHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with buildWelcome(fr)", async () => {
    const ctx = createMockContext();
    await startHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(buildWelcome(fr));
  });

  it("calls setConfig to persist chat_id", async () => {
    const ctx = createMockContext(99_999);
    await startHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(ctx.db, "chat_id", "99999");
  });

  it("calls reply exactly once", async () => {
    const ctx = createMockContext();
    await startHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });
});

describe("helpHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with buildWelcome(fr)", async () => {
    const ctx = createMockContext();
    await helpHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(buildWelcome(fr));
  });

  it("does NOT call setConfig", async () => {
    const ctx = createMockContext();
    await helpHandler(ctx);
    expect(setConfig).not.toHaveBeenCalled();
  });

  it("calls reply exactly once", async () => {
    const ctx = createMockContext();
    await helpHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });
});

describe("configHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche la config actuelle sans arguments", async () => {
    vi.mocked(getConfig)
      .mockResolvedValueOnce("Playa del Carmen")
      .mockResolvedValueOnce("MX")
      .mockResolvedValueOnce("America/Cancun");

    const ctx = makeConfigCtx("");
    await configHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Configuration");
    expect(msg).toContain("Playa del Carmen");
    expect(msg).toContain("MX");
    expect(msg).toContain("America/Cancun");
  });

  it("affiche les valeurs par defaut si config absente", async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    const ctx = makeConfigCtx("");
    await configHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Mecca");
    expect(msg).toContain("(défaut)");
  });

  it("met a jour la ville et vide le cache", async () => {
    const ctx = makeConfigCtx("city Cancun");
    await configHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(ctx.db, "city", "Cancun");
    expect(clearPrayerCache).toHaveBeenCalledWith(ctx.db);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Cancun");
    expect(msg).toContain("réinitialisé");
  });

  it("accepte une ville avec espaces", async () => {
    const ctx = makeConfigCtx("city Playa del Carmen");
    await configHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(ctx.db, "city", "Playa del Carmen");
  });

  it("met a jour le pays et vide le cache", async () => {
    const ctx = makeConfigCtx("country MX");
    await configHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(ctx.db, "country", "MX");
    expect(clearPrayerCache).toHaveBeenCalledWith(ctx.db);
  });

  it("normalise le pays en majuscules", async () => {
    const ctx = makeConfigCtx("country mx");
    await configHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(ctx.db, "country", "MX");
  });

  it("rejette un code pays invalide", async () => {
    const ctx = makeConfigCtx("country USA");
    await configHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("2 lettres");
  });

  it("met a jour le timezone", async () => {
    const ctx = makeConfigCtx("timezone America/New_York");
    await configHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(
      ctx.db,
      "timezone",
      "America/New_York"
    );
  });

  it("accepte tz comme alias de timezone", async () => {
    const ctx = makeConfigCtx("tz America/New_York");
    await configHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(
      ctx.db,
      "timezone",
      "America/New_York"
    );
  });

  it("rejette un fuseau horaire invalide", async () => {
    const ctx = makeConfigCtx("timezone Invalid/Zone");
    await configHandler(ctx);
    expect(setConfig).not.toHaveBeenCalled();
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("fuseau horaire invalide");
  });

  it("rejette un parametre inconnu", async () => {
    const ctx = makeConfigCtx("foo bar");
    await configHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("paramètre inconnu");
  });

  it("rejette une valeur manquante", async () => {
    const ctx = makeConfigCtx("city");
    await configHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("valeur manquante");
  });

  it("affiche le clavier de langue sans valeur", async () => {
    const ctx = makeConfigCtx("language");
    await configHandler(ctx);
    const opts = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts.reply_markup).toBeDefined();
  });

  it("affiche le clavier de langue avec alias lang", async () => {
    const ctx = makeConfigCtx("lang");
    await configHandler(ctx);
    const opts = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts.reply_markup).toBeDefined();
  });

  it("met a jour la langue via texte (valide)", async () => {
    const mockApi = { setMyCommands: vi.fn().mockResolvedValue(undefined) };
    const ctx = {
      ...makeConfigCtx("language fr"),
      api: mockApi,
    } as unknown as CustomContext;
    await configHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(ctx.db, "language", "fr");
    expect(invalidateLocaleCache).toHaveBeenCalled();
    expect(mockApi.setMyCommands).toHaveBeenCalledWith(getBotCommands(fr));
  });

  it("rejette une langue invalide via texte", async () => {
    const ctx = makeConfigCtx("language xx");
    await configHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
  });
});

function makeLangCallbackCtx(match: string[] | undefined): CustomContext {
  return {
    match,
    db: {} as D1Database,
    locale: fr,
    api: { setMyCommands: vi.fn().mockResolvedValue(undefined) },
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
  } as unknown as CustomContext;
}

describe("langSetCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("met a jour la langue et repond au callback", async () => {
    const ctx = makeLangCallbackCtx(["lang_set:en", "en"]);
    await langSetCallback(ctx);
    expect(setConfig).toHaveBeenCalledWith(ctx.db, "language", "en");
    expect(invalidateLocaleCache).toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      en.config.languageUpdated("en")
    );
  });

  it("repond au callback meme avec une langue invalide", async () => {
    const ctx = makeLangCallbackCtx(["lang_set:xx", "xx"]);
    await langSetCallback(ctx);
    expect(setConfig).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("repond au callback quand match est undefined", async () => {
    const ctx = makeLangCallbackCtx(undefined);
    await langSetCallback(ctx);
    expect(setConfig).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("repond au callback meme si applyLanguageChange echoue", async () => {
    const ctx = makeLangCallbackCtx(["lang_set:fr", "fr"]);
    (ctx.api.setMyCommands as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network error")
    );
    await langSetCallback(ctx);
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});
