// tests/handlers/kahf.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { kahfHandler } from "../../src/handlers/kahf";
import type { CustomContext } from "../../src/bot";
import type { Session } from "../../src/services/db";

vi.mock("../../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/db")>();
  return {
    ...actual,
    insertSession: vi.fn(),
    getConfig: vi.fn(),
    getTimezone: vi.fn(),
    getNowTimestamp: vi.fn(),
    getKahfSessionsThisWeek: vi.fn(),
    getLastWeekKahfTotal: vi.fn(),
  };
});

import {
  insertSession,
  getConfig,
  getTimezone,
  getNowTimestamp,
  getKahfSessionsThisWeek,
  getLastWeekKahfTotal,
} from "../../src/services/db";

const mockInsertSession = insertSession as ReturnType<typeof vi.fn>;
const mockGetKahfSessionsThisWeek = getKahfSessionsThisWeek as ReturnType<typeof vi.fn>;
const mockGetLastWeekKahfTotal = getLastWeekKahfTotal as ReturnType<typeof vi.fn>;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    startedAt: "2026-03-15 10:00:00",
    durationSeconds: 300,
    pageStart: 293,
    pageEnd: 293,
    surahStart: 17,
    ayahStart: 105,
    surahEnd: 18,
    ayahEnd: 4,
    ayahCount: 10,
    type: "kahf",
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

describe("kahfHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getNowTimestamp).mockReturnValue("2026-03-15 14:00:00");
    mockGetKahfSessionsThisWeek.mockResolvedValue([]); // no sessions this week
    mockGetLastWeekKahfTotal.mockResolvedValue(0);
  });

  it("/kahf 5m -> premiere page de la semaine (page 293), kahf page 1/12", async () => {
    const session = makeSession({
      id: 1,
      durationSeconds: 300,
      pageStart: 293,
      pageEnd: 293,
    });
    mockInsertSession.mockResolvedValue(session);

    const ctx = createMockContext("5m");
    await kahfHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("1/12");
    expect(msg).toContain("5m");

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "kahf",
        pageStart: 293,
        pageEnd: 293,
      }),
    );
  });

  it("/kahf 5m avec 2 pages deja lues -> page 295, kahf page 3/12", async () => {
    mockGetKahfSessionsThisWeek.mockResolvedValue([
      makeSession({ pageStart: 293, pageEnd: 294, durationSeconds: 600 }),
    ]);
    const session = makeSession({
      id: 2,
      pageStart: 295,
      pageEnd: 295,
      durationSeconds: 300,
    });
    mockInsertSession.mockResolvedValue(session);

    const ctx = createMockContext("5m");
    await kahfHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("3/12");

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageStart: 295,
        pageEnd: 295,
      }),
    );
  });

  it("/kahf 3 15m -> plusieurs pages a la fois", async () => {
    const session = makeSession({
      id: 3,
      pageStart: 293,
      pageEnd: 295,
      durationSeconds: 900,
    });
    mockInsertSession.mockResolvedValue(session);

    const ctx = createMockContext("3 15m");
    await kahfHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("3/12");
    expect(msg).toContain("15m");

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageStart: 293,
        pageEnd: 295,
        durationSeconds: 900,
        type: "kahf",
      }),
    );
  });

  it("/kahf 5m quand les 12 pages sont terminees -> message deja terminee", async () => {
    // 12 pages already read
    mockGetKahfSessionsThisWeek.mockResolvedValue([
      makeSession({ pageStart: 293, pageEnd: 304, durationSeconds: 3600 }),
    ]);

    const ctx = createMockContext("5m");
    await kahfHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Al-Kahf deja terminee cette semaine");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("/kahf 3 5m quand il ne reste qu'1 page -> erreur pages restantes", async () => {
    // 11 pages already read
    mockGetKahfSessionsThisWeek.mockResolvedValue([
      makeSession({ pageStart: 293, pageEnd: 303, durationSeconds: 3300 }),
    ]);

    const ctx = createMockContext("3 5m");
    await kahfHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("1 page(s)");
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("completion: quand la lecture atteint 12/12 -> message de completion", async () => {
    // 11 pages already read
    mockGetKahfSessionsThisWeek.mockResolvedValue([
      makeSession({ pageStart: 293, pageEnd: 303, durationSeconds: 3300 }),
    ]);
    mockGetLastWeekKahfTotal.mockResolvedValue(3600);

    const session = makeSession({
      id: 12,
      pageStart: 304,
      pageEnd: 304,
      durationSeconds: 300,
    });
    mockInsertSession.mockResolvedValue(session);

    const ctx = createMockContext("5m");
    await kahfHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("terminee");
    expect(msg).toContain("12/12");
    expect(msg).toContain("Semaine derniere");
  });

  it("erreur: duree manquante", async () => {
    const ctx = createMockContext("");
    await kahfHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format invalide");
  });

  it("passe type='kahf' a insertSession", async () => {
    const session = makeSession();
    mockInsertSession.mockResolvedValue(session);

    const ctx = createMockContext("5m");
    await kahfHandler(ctx);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "kahf" }),
    );
  });
});
