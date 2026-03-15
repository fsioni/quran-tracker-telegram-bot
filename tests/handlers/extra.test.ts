// tests/handlers/extra.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { extraHandler } from "../../src/handlers/extra";
import type { CustomContext } from "../../src/bot";
import type { Session } from "../../src/services/db";

vi.mock("../../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/db")>();
  return {
    ...actual,
    insertSession: vi.fn(),
    getConfig: vi.fn(),
  };
});

import { insertSession, getConfig } from "../../src/services/db";

const mockInsertSession = insertSession as ReturnType<typeof vi.fn>;
const mockGetConfig = getConfig as ReturnType<typeof vi.fn>;

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
    chat: { id: 12345 },
    db: {} as D1Database,
  } as unknown as CustomContext;
}

describe("extraHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(null);
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
    mockInsertSession.mockResolvedValue(session);

    const ctx = createMockContext("300 5m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session extra enregistree");

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "extra",
        pageStart: 300,
        pageEnd: 300,
        durationSeconds: 300,
      }),
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
    mockInsertSession.mockResolvedValue(session);

    const ctx = createMockContext("300-304 15m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session extra enregistree");

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "extra",
        pageStart: 300,
        pageEnd: 304,
        durationSeconds: 900,
      }),
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
    mockInsertSession.mockResolvedValue(session);

    const ctx = createMockContext("2:77-83 15m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session extra enregistree");

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
      }),
    );
  });

  it("erreur: page invalide (0)", async () => {
    const ctx = createMockContext("0 5m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("page invalide");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("erreur: page invalide (605)", async () => {
    const ctx = createMockContext("605 5m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("page invalide");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("erreur: format invalide (abc 5m)", async () => {
    const ctx = createMockContext("abc 5m");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format invalide");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("erreur: arguments manquants", async () => {
    const ctx = createMockContext("");
    await extraHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format invalide");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("passe type='extra' a insertSession", async () => {
    const session = makeSession();
    mockInsertSession.mockResolvedValue(session);

    const ctx = createMockContext("1 5m");
    await extraHandler(ctx);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "extra" }),
    );
  });
});
