// tests/handlers/read.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readHandler } from "../../src/handlers/read";
import type { CustomContext } from "../../src/bot";
import type { Session } from "../../src/services/db";
import { TOTAL_PAGES } from "../../src/data/pages";
import { fr } from "../../src/locales/fr";

vi.mock("../../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/db")>();
  return {
    ...actual,
    getLastSession: vi.fn(),
    insertSession: vi.fn(),
    insertKhatma: vi.fn(),
    getKhatmaCount: vi.fn(),
    getConfig: vi.fn(),
    getTimezone: vi.fn(),
    getNowTimestamp: vi.fn(),
  };
});

import { getLastSession, insertSession, insertKhatma, getKhatmaCount, getConfig, getTimezone, getNowTimestamp } from "../../src/services/db";

const mockGetLastSession = getLastSession as ReturnType<typeof vi.fn>;
const mockInsertSession = insertSession as ReturnType<typeof vi.fn>;
const mockGetConfig = getConfig as ReturnType<typeof vi.fn>;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    startedAt: "2026-03-15 10:00:00",
    durationSeconds: 300,
    pageStart: 1,
    pageEnd: 1,
    surahStart: 1,
    ayahStart: 1,
    surahEnd: 1,
    ayahEnd: 7,
    ayahCount: 7,
    type: "normal",
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
    locale: fr,
  } as unknown as CustomContext;
}

describe("readHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(null); // default timezone
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getNowTimestamp).mockReturnValue("2026-03-15 14:00:00");
    mockGetLastSession.mockResolvedValue(null); // no previous session
    vi.mocked(insertKhatma).mockResolvedValue({ id: 1, completedAt: "2026-03-15 14:00:00" });
    vi.mocked(getKhatmaCount).mockResolvedValue(0);
  });

  it("/read 5m sans session précédente -> enregistre page 1", async () => {
    const session = makeSession({
      id: 1,
      durationSeconds: 300,
      pageStart: 1,
      pageEnd: 1,
      surahStart: 1,
      ayahStart: 1,
      surahEnd: 1,
      ayahEnd: 7,
      ayahCount: 7,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("5m");
    await readHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Page 1");
    expect(msg).toContain("5m");
    expect(msg).toContain("1/604");
    expect(msg).toContain("Prochaine page : 2");

    // Verify insertSession was called with type 'normal' and page data
    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "normal",
        pageStart: 1,
        pageEnd: 1,
      }),
    );
  });

  it("/read 5m avec dernière session pageEnd=41 -> enregistre page 42", async () => {
    mockGetLastSession.mockResolvedValue(
      makeSession({ pageEnd: 41 }),
    );
    const session = makeSession({
      id: 2,
      pageStart: 42,
      pageEnd: 42,
      surahStart: 2,
      ayahStart: 253,
      surahEnd: 2,
      ayahEnd: 256,
      ayahCount: 4,
      durationSeconds: 300,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("5m");
    await readHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Page 42");
    expect(msg).toContain("42/604");

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageStart: 42,
        pageEnd: 42,
      }),
    );
  });

  it("/read 3 15m -> enregistre 3 pages", async () => {
    const session = makeSession({
      id: 3,
      pageStart: 1,
      pageEnd: 3,
      surahStart: 1,
      ayahStart: 1,
      surahEnd: 2,
      ayahEnd: 5,
      ayahCount: 12,
      durationSeconds: 900,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("3 15m");
    await readHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Pages 1-3");
    expect(msg).toContain("15m");
    expect(msg).toContain("3/604");
    expect(msg).toContain("Prochaine page : 4");

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageStart: 1,
        pageEnd: 3,
        type: "normal",
        durationSeconds: 900,
      }),
    );
  });

  it("/read 5m à page 604 -> khatma message", async () => {
    mockGetLastSession.mockResolvedValue(
      makeSession({ pageEnd: 603 }),
    );
    const session = makeSession({
      id: 4,
      pageStart: 604,
      pageEnd: 604,
      durationSeconds: 300,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });
    vi.mocked(getKhatmaCount).mockResolvedValue(1);

    const ctx = createMockContext("5m");
    await readHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Khatma");
    expect(msg).toContain("première");
    expect(msg).toContain("Alhamdulillah");
    expect(insertKhatma).toHaveBeenCalled();
    expect(getKhatmaCount).toHaveBeenCalled();
  });

  it("/read 5m quand currentPage > 604 -> reprend à page 1", async () => {
    mockGetLastSession.mockResolvedValue(
      makeSession({ pageEnd: 604 }),
    );
    const session = makeSession({
      pageStart: 1,
      pageEnd: 1,
      surahStart: 1,
      ayahStart: 1,
      surahEnd: 1,
      ayahEnd: 7,
      ayahCount: 7,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("5m");
    await readHandler(ctx);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageStart: 1,
        pageEnd: 1,
      }),
    );
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Page 1");
    expect(msg).toContain("Prochaine page : 2");
  });

  it("erreur si pageEnd dépasse 604", async () => {
    mockGetLastSession.mockResolvedValue(
      makeSession({ pageEnd: 603 }),
    );

    const ctx = createMockContext("3 5m");
    await readHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("1 page(s)");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("erreur si durée manquante", async () => {
    const ctx = createMockContext("");
    await readHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format invalide");
  });

  it("erreur si format de durée invalide", async () => {
    const ctx = createMockContext("abc");
    await readHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format de durée invalide");
  });

  it("passe type='normal' à insertSession", async () => {
    const session = makeSession();
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("5m");
    await readHandler(ctx);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "normal" }),
    );
  });

  it("démarre à page 1 si dernière session n'a pas de pageEnd", async () => {
    mockGetLastSession.mockResolvedValue(
      makeSession({ pageEnd: null }),
    );
    const session = makeSession({
      pageStart: 1,
      pageEnd: 1,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("5m");
    await readHandler(ctx);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageStart: 1,
        pageEnd: 1,
      }),
    );
  });

  it("/read terminant une sourate -> message de fin de sourate", async () => {
    // Page 1 = Al-Fatiha 1:1 to 1:7 (complete surah)
    const session = makeSession({
      pageStart: 1,
      pageEnd: 1,
      surahStart: 1,
      ayahStart: 1,
      surahEnd: 1,
      ayahEnd: 7,
      ayahCount: 7,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("5m");
    await readHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Sourate Al-Fatiha (1) terminée");
  });

  it("pas de message fin de sourate en milieu de sourate", async () => {
    mockGetLastSession.mockResolvedValue(makeSession({ pageEnd: 41 }));
    const session = makeSession({
      pageStart: 42,
      pageEnd: 42,
      surahStart: 2,
      ayahStart: 253,
      surahEnd: 2,
      ayahEnd: 256,
      ayahCount: 4,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMockContext("5m");
    await readHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).not.toContain("terminée");
  });
});
