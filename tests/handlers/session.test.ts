// tests/handlers/session.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomContext } from "../../src/bot";
import { sessionHandler } from "../../src/handlers/session";
import { fr } from "../../src/locales/fr";
import type { Session } from "../../src/services/db/types";

const PCT_RE = /[+-]\d+%/;

vi.mock("../../src/services/db/date-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/date-helpers")>();
  return { ...actual, getTimezone: vi.fn(), getNowTimestamp: vi.fn() };
});
vi.mock("../../src/services/db/sessions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/sessions")>();
  return { ...actual, insertSession: vi.fn() };
});
vi.mock("../../src/services/db/speed", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/db/speed")>();
  return { ...actual, get7DayTypeAvgSpeed: vi.fn() };
});

import {
  getNowTimestamp,
  getTimezone,
} from "../../src/services/db/date-helpers";
import { insertSession } from "../../src/services/db/sessions";
import { get7DayTypeAvgSpeed } from "../../src/services/db/speed";

const mockInsertSession = insertSession as ReturnType<typeof vi.fn>;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    startedAt: "2026-03-13 14:00:00",
    durationSeconds: 533,
    pageStart: null,
    pageEnd: null,
    surahStart: 2,
    ayahStart: 77,
    surahEnd: 2,
    ayahEnd: 83,
    ayahCount: 7,
    type: "normal",
    createdAt: "2026-03-13 14:00:00",
    ...overrides,
  };
}

function createMockContext(match = ""): CustomContext {
  return {
    match,
    reply: vi.fn().mockResolvedValue(undefined),
    chat: { id: 12_345 },
    db: {} as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

describe("sessionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getNowTimestamp).mockReturnValue("2026-03-13 14:00:00");
    mockInsertSession.mockResolvedValue({
      ok: true,
      value: makeSession(),
    });
    vi.mocked(get7DayTypeAvgSpeed).mockResolvedValue({
      pagesPerHour: null,
      versesPerHour: null,
    });
  });

  it("enregistre une session same-surah et repond avec confirmation", async () => {
    const ctx = createMockContext("2:77-83 8m53");
    await sessionHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Session enregistrée");
    expect(msg).toContain("Al-Baqara");
    expect(msg).toContain("7 versets");
  });

  it("repond erreur sans arguments", async () => {
    const ctx = createMockContext("");
    await sessionHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("/session 2:77-83 8m53");
  });

  it("repond erreur si duree manquante", async () => {
    const ctx = createMockContext("2:77-83");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
  });

  it("repond erreur pour format de plage invalide", async () => {
    const ctx = createMockContext("invalid 8m53");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format de plage invalide");
  });

  it("repond erreur pour format de duree invalide", async () => {
    const ctx = createMockContext("2:77-83 8min");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format de durée invalide");
  });

  it("repond erreur pour sourate hors bornes", async () => {
    const ctx = createMockContext("115:1-5 8m");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("n'existe pas");
  });

  it("repond erreur pour verset hors bornes", async () => {
    const ctx = createMockContext("1:1-99 8m");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("n'a que");
  });

  it("repond erreur pour plage inversee", async () => {
    const ctx = createMockContext("2:83-77 8m");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("précède le début");
  });

  it("enregistre une session cross-surah", async () => {
    mockInsertSession.mockResolvedValue({
      ok: true,
      value: makeSession({
        id: 2,
        surahStart: 2,
        ayahStart: 280,
        surahEnd: 3,
        ayahEnd: 10,
        ayahCount: 17,
      }),
    });

    const ctx = createMockContext("2:280-3:10 8m53");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Session enregistrée");
    expect(msg).toContain("Al-Baqara");
    expect(msg).toContain("Al-Imran");
    expect(msg).toContain("17 versets");
  });

  it("n'appelle pas insertSession pour les erreurs de format", async () => {
    const ctx = createMockContext("");
    await sessionHandler(ctx);
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("appelle insertSession pour une session valide", async () => {
    const ctx = createMockContext("2:77-83 8m53");
    await sessionHandler(ctx);
    expect(mockInsertSession).toHaveBeenCalled();
  });

  it("session completant une sourate -> message de fin", async () => {
    mockInsertSession.mockResolvedValue({
      ok: true,
      value: makeSession({
        id: 10,
        durationSeconds: 300,
        surahStart: 1,
        ayahStart: 1,
        surahEnd: 1,
        ayahEnd: 7,
        ayahCount: 7,
      }),
    });

    const ctx = createMockContext("1:1-7 5m");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Session enregistrée");
    expect(msg).toContain("Sourate Al-Fatiha (1) terminée");
  });

  it("session en milieu de sourate -> pas de message de fin", async () => {
    const ctx = createMockContext("2:100-150 8m");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Session enregistrée");
    expect(msg).not.toContain("terminée");
  });

  it("affiche la comparaison de vitesse quand une moyenne 7j existe", async () => {
    // 7 ayahs in 533s = ~47.3 v/h; avg = 40 v/h -> +18%
    vi.mocked(get7DayTypeAvgSpeed).mockResolvedValue({
      pagesPerHour: null,
      versesPerHour: 40,
    });

    const ctx = createMockContext("2:77-83 8m53");
    await sessionHandler(ctx);

    expect(get7DayTypeAvgSpeed).toHaveBeenCalledWith(
      expect.anything(),
      "normal",
      "America/Cancun",
      1
    );
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("vs votre moy. 7j");
    expect(msg).toMatch(PCT_RE);
  });

  it("pas de comparaison quand aucune moyenne 7j", async () => {
    vi.mocked(get7DayTypeAvgSpeed).mockResolvedValue({
      pagesPerHour: null,
      versesPerHour: null,
    });

    const ctx = createMockContext("2:77-83 8m53");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).not.toContain("vs votre moy. 7j");
  });
});
