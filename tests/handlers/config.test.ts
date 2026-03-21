import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CustomContext } from "../../src/bot";
import { fr } from "../../src/locales/fr";
import { buildWelcome } from "../../src/locales";

vi.mock("../../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/db")>();
  return {
    ...actual,
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    clearPrayerCache: vi.fn(),
  };
});

import { getConfig, setConfig, clearPrayerCache } from "../../src/services/db";
import {
  startHandler,
  helpHandler,
  configHandler,
} from "../../src/handlers/config";

function createMockContext(chatId = 12345): CustomContext {
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
    const ctx = createMockContext(99999);
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

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Configuration");
    expect(msg).toContain("Playa del Carmen");
    expect(msg).toContain("MX");
    expect(msg).toContain("America/Cancun");
  });

  it("affiche les valeurs par defaut si config absente", async () => {
    vi.mocked(getConfig).mockResolvedValue(null);
    const ctx = makeConfigCtx("");
    await configHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Mecca");
    expect(msg).toContain("(défaut)");
  });

  it("met a jour la ville et vide le cache", async () => {
    const ctx = makeConfigCtx("city Cancun");
    await configHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(ctx.db, "city", "Cancun");
    expect(clearPrayerCache).toHaveBeenCalledWith(ctx.db);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
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
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("2 lettres");
  });

  it("met a jour le timezone", async () => {
    const ctx = makeConfigCtx("timezone America/New_York");
    await configHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(ctx.db, "timezone", "America/New_York");
  });

  it("accepte tz comme alias de timezone", async () => {
    const ctx = makeConfigCtx("tz America/New_York");
    await configHandler(ctx);
    expect(setConfig).toHaveBeenCalledWith(ctx.db, "timezone", "America/New_York");
  });

  it("rejette un fuseau horaire invalide", async () => {
    const ctx = makeConfigCtx("timezone Invalid/Zone");
    await configHandler(ctx);
    expect(setConfig).not.toHaveBeenCalled();
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("fuseau horaire invalide");
  });

  it("rejette un parametre inconnu", async () => {
    const ctx = makeConfigCtx("foo bar");
    await configHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("paramètre inconnu");
  });

  it("rejette une valeur manquante", async () => {
    const ctx = makeConfigCtx("city");
    await configHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("valeur manquante");
  });

});
