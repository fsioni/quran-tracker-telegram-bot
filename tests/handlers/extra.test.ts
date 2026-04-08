// tests/handlers/extra.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomContext } from "../../src/bot";
import { extraHandler } from "../../src/handlers/extra";
import { fr } from "../../src/locales/fr";
import type { Session } from "../../src/services/db/types";

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

import {
  getNowTimestamp,
  getTimezone,
} from "../../src/services/db/date-helpers";
import { insertSession } from "../../src/services/db/sessions";

const mockInsertSession = insertSession as ReturnType<typeof vi.fn>;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    startedAt: "2026-03-15 10:00:00",
    durationSeconds: 300,
    pageStart: null,
    pageEnd: null,
    surahStart: 1,
    ayahStart: 1,
    surahEnd: 1,
    ayahEnd: 7,
    ayahCount: 7,
    type: "extra",
    createdAt: "2026-03-15 10:00:00",
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

describe("extraHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getNowTimestamp).mockReturnValue("2026-03-15 14:00:00");
  });

  it("/extra 300 5m -> page unique, type='extra'", async () => {
    const session = makeSession({
      id: 1,
      durationSeconds: 300,
      pageStart: 300,
      pageEnd: 300,
      surahStart: 14,
      ayahStart: 27,
      surahEnd: 14,
      ayahEnd: 34,
      ayahCount: 8,
      type: "extra",
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("300 5m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Session extra enregistrée");

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "extra",
        pageStart: 300,
        pageEnd: 300,
        durationSeconds: 300,
      })
    );
  });

  it("/extra 300-304 15m -> page range, type='extra'", async () => {
    const session = makeSession({
      id: 2,
      durationSeconds: 900,
      pageStart: 300,
      pageEnd: 304,
      surahStart: 14,
      ayahStart: 27,
      surahEnd: 15,
      ayahEnd: 1,
      ayahCount: 30,
      type: "extra",
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("300-304 15m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Session extra enregistrée");

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "extra",
        pageStart: 300,
        pageEnd: 304,
        durationSeconds: 900,
      })
    );
  });

  it("/extra 2:77-83 15m -> surah:ayah format, type='extra'", async () => {
    const session = makeSession({
      id: 3,
      durationSeconds: 900,
      surahStart: 2,
      ayahStart: 77,
      surahEnd: 2,
      ayahEnd: 83,
      ayahCount: 7,
      type: "extra",
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("2:77-83 15m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Session extra enregistrée");

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "extra",
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
        ayahCount: 7,
        durationSeconds: 900,
      })
    );
  });

  it("erreur: page invalide (0)", async () => {
    const ctx = createMockContext("0 5m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("page invalide");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("erreur: page invalide (605)", async () => {
    const ctx = createMockContext("605 5m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("page invalide");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("erreur: format invalide (abc 5m)", async () => {
    const ctx = createMockContext("abc 5m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format invalide");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("erreur: arguments manquants", async () => {
    const ctx = createMockContext("");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format invalide");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("passe type='extra' à insertSession", async () => {
    const session = makeSession();
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("1 5m");
    await extraHandler(ctx);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "extra" })
    );
  });

  it("/extra 1:1-7 5m completant une sourate -> message de fin", async () => {
    const session = makeSession({
      surahStart: 1,
      ayahStart: 1,
      surahEnd: 1,
      ayahEnd: 7,
      ayahCount: 7,
      type: "extra",
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("1:1-7 5m");
    await extraHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Session extra enregistrée");
    expect(msg).toContain("Sourate Al-Fatiha (1) terminée");
  });

  it("/extra 2:100-150 8m en milieu de sourate -> pas de message de fin", async () => {
    const session = makeSession({
      surahStart: 2,
      ayahStart: 100,
      surahEnd: 2,
      ayahEnd: 150,
      ayahCount: 51,
      type: "extra",
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("2:100-150 8m");
    await extraHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).not.toContain("terminée");
  });
});
