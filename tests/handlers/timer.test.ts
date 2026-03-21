// tests/handlers/timer.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  goHandler,
  stopHandler,
  stopTimerCallback,
  goTimerCallback,
  timerResponseHandler,
  confirmTimerStopCallback,
  cancelTimerStopCallback,
} from "../../src/handlers/timer";
import type { CustomContext } from "../../src/bot";
import type { Session, TimerState } from "../../src/services/db";
import { fr } from "../../src/locales/fr";

vi.mock("../../src/services/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/db")>();
  return {
    ...actual,
    getTimerState: vi.fn(),
    setTimerState: vi.fn(),
    clearTimerState: vi.fn(),
    getLastSession: vi.fn(),
    insertSession: vi.fn(),
    getConfig: vi.fn(),
    getTimezone: vi.fn(),
    getNowTimestamp: vi.fn(),
    getKahfSessionsThisWeek: vi.fn(),
    getLastWeekKahfTotal: vi.fn(),
  };
});

import {
  getTimerState,
  setTimerState,
  clearTimerState,
  getLastSession,
  insertSession,
  getTimezone,
  getNowTimestamp,
  getKahfSessionsThisWeek,
  getLastWeekKahfTotal,
} from "../../src/services/db";

const mockGetTimerState = getTimerState as ReturnType<typeof vi.fn>;
const mockSetTimerState = setTimerState as ReturnType<typeof vi.fn>;
const mockClearTimerState = clearTimerState as ReturnType<typeof vi.fn>;
const mockGetLastSession = getLastSession as ReturnType<typeof vi.fn>;
const mockInsertSession = insertSession as ReturnType<typeof vi.fn>;
const mockGetKahfSessionsThisWeek = getKahfSessionsThisWeek as ReturnType<typeof vi.fn>;
const mockGetLastWeekKahfTotal = getLastWeekKahfTotal as ReturnType<typeof vi.fn>;

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

function makeTimerState(overrides: Partial<TimerState> = {}): TimerState {
  return {
    startedAt: "2026-03-15 10:00:00",
    startedEpoch: Date.now() - 300000, // 5 minutes ago
    type: "normal_page",
    args: "{}",
    awaitingResponse: false,
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

function createCallbackContext(data: string): CustomContext {
  return {
    callbackQuery: { data },
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    db: {} as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

function createMessageContext(text: string): CustomContext {
  return {
    message: { text },
    reply: vi.fn().mockResolvedValue(undefined),
    chat: { id: 12345 },
    db: {} as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

describe("goHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTimerState.mockResolvedValue(null);
    mockSetTimerState.mockResolvedValue(undefined);
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getNowTimestamp).mockReturnValue("2026-03-15 14:00:00");
    mockGetLastSession.mockResolvedValue(null);
    mockGetKahfSessionsThisWeek.mockResolvedValue([]);
  });

  it("/go sans timer -> demarre normal_page", async () => {
    const ctx = createMockContext("");
    await goHandler(ctx);

    expect(mockSetTimerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "normal_page",
        args: "{}",
        awaitingResponse: false,
      }),
    );
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Timer démarré");
    expect(msg).toContain("normale");
  });

  it("/go 2:77 -> demarre normal_verse", async () => {
    const ctx = createMockContext("2:77");
    await goHandler(ctx);

    expect(mockSetTimerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "normal_verse",
        args: JSON.stringify({ surah: 2, ayah: 77 }),
      }),
    );
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Timer démarré");
    expect(msg).toContain("2:77");
  });

  it("/go extra 300 -> demarre extra_page", async () => {
    const ctx = createMockContext("extra 300");
    await goHandler(ctx);

    expect(mockSetTimerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "extra_page",
        args: JSON.stringify({ page: 300 }),
      }),
    );
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Timer démarré");
    expect(msg).toContain("extra");
    expect(msg).toContain("300");
  });

  it("/go extra 2:77 -> demarre extra_verse", async () => {
    const ctx = createMockContext("extra 2:77");
    await goHandler(ctx);

    expect(mockSetTimerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "extra_verse",
        args: JSON.stringify({ surah: 2, ayah: 77 }),
      }),
    );
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Timer démarré");
    expect(msg).toContain("extra");
  });

  it("/go kahf -> demarre kahf", async () => {
    const ctx = createMockContext("kahf");
    await goHandler(ctx);

    expect(mockSetTimerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "kahf",
        args: "{}",
      }),
    );
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Timer démarré");
    expect(msg).toContain("Al-Kahf");
  });

  it("/go avec timer actif -> erreur", async () => {
    mockGetTimerState.mockResolvedValue(makeTimerState());

    const ctx = createMockContext("");
    await goHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("timer est déjà actif");
    expect(mockSetTimerState).not.toHaveBeenCalled();
  });

  it("/go avec verset invalide -> erreur", async () => {
    const ctx = createMockContext("999:1");
    await goHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(mockSetTimerState).not.toHaveBeenCalled();
  });

  it("/go kahf quand kahf complet -> erreur", async () => {
    mockGetKahfSessionsThisWeek.mockResolvedValue([
      makeSession({ pageStart: 293, pageEnd: 304, type: "kahf" }),
    ]);

    const ctx = createMockContext("kahf");
    await goHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Al-Kahf déjà terminée cette semaine");
    expect(mockSetTimerState).not.toHaveBeenCalled();
  });

  it("/go quand Coran termine -> erreur", async () => {
    mockGetLastSession.mockResolvedValue(makeSession({ pageEnd: 604 }));

    const ctx = createMockContext("");
    await goHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("terminé le Coran");
    expect(mockSetTimerState).not.toHaveBeenCalled();
  });

  it("/go extra 0 -> erreur page invalide", async () => {
    const ctx = createMockContext("extra 0");
    await goHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(mockSetTimerState).not.toHaveBeenCalled();
  });

  it("/go -> reply inclut un bouton inline Stop", async () => {
    const ctx = createMockContext("");
    await goHandler(ctx);

    const opts = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts).toHaveProperty("reply_markup");
  });

  it("/go abc -> erreur format", async () => {
    const ctx = createMockContext("abc");
    await goHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format invalide");
    expect(mockSetTimerState).not.toHaveBeenCalled();
  });
});

describe("stopHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearTimerState.mockResolvedValue(undefined);
    mockSetTimerState.mockResolvedValue(undefined);
  });

  it("/stop avec timer -> duree + question (normal_page)", async () => {
    const epoch = Date.now() - 300000; // 5 min ago
    mockGetTimerState.mockResolvedValue(
      makeTimerState({ startedEpoch: epoch, type: "normal_page" }),
    );

    const ctx = createMockContext("");
    await stopHandler(ctx);

    expect(mockSetTimerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        awaitingResponse: true,
      }),
    );
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session arrêtée");
    expect(msg).toContain("pages");
  });

  it("/stop avec timer -> question versets pour normal_verse", async () => {
    const epoch = Date.now() - 600000;
    mockGetTimerState.mockResolvedValue(
      makeTimerState({ startedEpoch: epoch, type: "normal_verse" }),
    );

    const ctx = createMockContext("");
    await stopHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session arrêtée");
    expect(msg).toContain("Jusqu'où");
  });

  it("/stop avec timer -> question kahf", async () => {
    const epoch = Date.now() - 600000;
    mockGetTimerState.mockResolvedValue(
      makeTimerState({ startedEpoch: epoch, type: "kahf" }),
    );

    const ctx = createMockContext("");
    await stopHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session arrêtée");
    expect(msg).toContain("Al-Kahf");
  });

  it("/stop sans timer -> erreur", async () => {
    mockGetTimerState.mockResolvedValue(null);

    const ctx = createMockContext("");
    await stopHandler(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("Aucun timer actif.");
  });

  it("/stop cancel avec timer -> annule", async () => {
    mockGetTimerState.mockResolvedValue(makeTimerState());

    const ctx = createMockContext("cancel");
    await stopHandler(ctx);

    expect(mockClearTimerState).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith("Timer annulé.");
  });

  it("/stop cancel en attente -> annule", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({ awaitingResponse: true, durationSeconds: 300 }),
    );

    const ctx = createMockContext("cancel");
    await stopHandler(ctx);

    expect(mockClearTimerState).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith("Timer annulé.");
  });

  it("/stop avec timer > 4h -> keyboard confirmation", async () => {
    const epoch = Date.now() - 5 * 3600 * 1000; // 5h ago
    mockGetTimerState.mockResolvedValue(
      makeTimerState({ startedEpoch: epoch }),
    );

    const ctx = createMockContext("");
    await stopHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("plus de 4h");
    expect(msg).toContain("Confirmer");
    const opts = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts).toHaveProperty("reply_markup");
    // Should capture duration but NOT set awaitingResponse yet
    expect(mockSetTimerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        awaitingResponse: false,
        durationSeconds: expect.any(Number),
      }),
    );
  });

  it("/stop en attente -> rappelle la question", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({
        awaitingResponse: true,
        durationSeconds: 300,
        type: "normal_page",
      }),
    );

    const ctx = createMockContext("");
    await stopHandler(ctx);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session arrêtée");
    expect(msg).toContain("pages");
    // Should not call setTimerState again
    expect(mockSetTimerState).not.toHaveBeenCalled();
  });
});

describe("confirmTimerStopCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetTimerState.mockResolvedValue(undefined);
  });

  it("confirme -> pose la question avec duree pre-capturee", async () => {
    const epoch = Date.now() - 5 * 3600 * 1000;
    mockGetTimerState.mockResolvedValue(
      makeTimerState({ startedEpoch: epoch, type: "normal_page", durationSeconds: 18000 }),
    );

    const ctx = createCallbackContext("timer_confirm_stop");
    await confirmTimerStopCallback(ctx);

    expect(mockSetTimerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ awaitingResponse: true }),
    );
    expect(ctx.editMessageText).toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("timer introuvable -> message erreur", async () => {
    mockGetTimerState.mockResolvedValue(null);

    const ctx = createCallbackContext("timer_confirm_stop");
    await confirmTimerStopCallback(ctx);

    expect(ctx.editMessageText).toHaveBeenCalledWith("Timer introuvable.");
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});

describe("cancelTimerStopCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearTimerState.mockResolvedValue(undefined);
  });

  it("annule le timer", async () => {
    const ctx = createCallbackContext("timer_cancel_stop");
    await cancelTimerStopCallback(ctx);

    expect(mockClearTimerState).toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledWith("Timer annulé.");
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});

describe("stopTimerCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearTimerState.mockResolvedValue(undefined);
    mockSetTimerState.mockResolvedValue(undefined);
  });

  it("sans timer -> editMessageText 'Aucun timer actif.'", async () => {
    mockGetTimerState.mockResolvedValue(null);

    const ctx = createCallbackContext("timer_stop");
    await stopTimerCallback(ctx);

    expect(ctx.editMessageText).toHaveBeenCalledWith("Aucun timer actif.");
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("timer normal -> arrete et pose la question", async () => {
    const epoch = Date.now() - 300000; // 5 min ago
    mockGetTimerState.mockResolvedValue(
      makeTimerState({ startedEpoch: epoch, type: "normal_page" }),
    );

    const ctx = createCallbackContext("timer_stop");
    await stopTimerCallback(ctx);

    expect(mockSetTimerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ awaitingResponse: true }),
    );
    const msg = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session arrêtée");
    expect(msg).toContain("pages");
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("timer > 4h -> confirmation keyboard", async () => {
    const epoch = Date.now() - 5 * 3600 * 1000; // 5h ago
    mockGetTimerState.mockResolvedValue(
      makeTimerState({ startedEpoch: epoch }),
    );

    const ctx = createCallbackContext("timer_stop");
    await stopTimerCallback(ctx);

    const msg = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("plus de 4h");
    expect(msg).toContain("Confirmer");
    const opts = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts).toHaveProperty("reply_markup");
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("timer en attente -> re-affiche la question", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({
        awaitingResponse: true,
        durationSeconds: 300,
        type: "normal_page",
      }),
    );

    const ctx = createCallbackContext("timer_stop");
    await stopTimerCallback(ctx);

    const msg = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session arrêtée");
    expect(msg).toContain("pages");
    expect(mockSetTimerState).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});

describe("timerResponseHandler", () => {
  const next = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTimerState.mockResolvedValue(null);
    mockClearTimerState.mockResolvedValue(undefined);
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    mockGetLastSession.mockResolvedValue(null);
    mockGetKahfSessionsThisWeek.mockResolvedValue([]);
    mockGetLastWeekKahfTotal.mockResolvedValue({ ok: true, value: 0 });
  });

  it("commande pendant attente -> next()", async () => {
    const ctx = createMessageContext("/help");
    await timerResponseHandler(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it("message sans timer -> next()", async () => {
    const ctx = createMessageContext("hello");
    await timerResponseHandler(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it("message avec timer non en attente -> next()", async () => {
    mockGetTimerState.mockResolvedValue(makeTimerState({ awaitingResponse: false }));
    const ctx = createMessageContext("3");
    await timerResponseHandler(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it("normal_page en attente -> parse count, insere session", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({
        awaitingResponse: true,
        durationSeconds: 300,
        type: "normal_page",
        args: "{}",
      }),
    );
    const session = makeSession({
      id: 1,
      pageStart: 1,
      pageEnd: 3,
      durationSeconds: 300,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMessageContext("3");
    await timerResponseHandler(ctx, next);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "normal",
        pageStart: 1,
        pageEnd: 3,
        durationSeconds: 300,
      }),
    );
    expect(mockClearTimerState).toHaveBeenCalled();
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Page");
    expect(next).not.toHaveBeenCalled();
  });

  it("normal_page en attente avec session precedente -> continue from last page", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({
        awaitingResponse: true,
        durationSeconds: 300,
        type: "normal_page",
        args: "{}",
      }),
    );
    mockGetLastSession.mockResolvedValue(makeSession({ pageEnd: 41 }));
    const session = makeSession({
      id: 2,
      pageStart: 42,
      pageEnd: 43,
      durationSeconds: 300,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMessageContext("2");
    await timerResponseHandler(ctx, next);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageStart: 42,
        pageEnd: 43,
      }),
    );
  });

  it("normal_verse en attente -> parse verset, insere session", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({
        awaitingResponse: true,
        durationSeconds: 600,
        type: "normal_verse",
        args: JSON.stringify({ surah: 2, ayah: 77 }),
      }),
    );
    const session = makeSession({
      id: 1,
      surahStart: 2,
      ayahStart: 77,
      surahEnd: 2,
      ayahEnd: 83,
      ayahCount: 7,
      durationSeconds: 600,
      type: "normal",
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMessageContext("2:83");
    await timerResponseHandler(ctx, next);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "normal",
        surahStart: 2,
        ayahStart: 77,
        surahEnd: 2,
        ayahEnd: 83,
      }),
    );
    expect(mockClearTimerState).toHaveBeenCalled();
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session enregistrée");
    expect(next).not.toHaveBeenCalled();
  });

  it("extra_verse en attente -> insere session extra", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({
        awaitingResponse: true,
        durationSeconds: 600,
        type: "extra_verse",
        args: JSON.stringify({ surah: 2, ayah: 77 }),
      }),
    );
    const session = makeSession({
      id: 1,
      surahStart: 2,
      ayahStart: 77,
      surahEnd: 2,
      ayahEnd: 83,
      ayahCount: 7,
      durationSeconds: 600,
      type: "extra",
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMessageContext("2:83");
    await timerResponseHandler(ctx, next);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "extra",
        surahStart: 2,
        ayahStart: 77,
      }),
    );
    expect(mockClearTimerState).toHaveBeenCalled();
  });

  it("extra_page en attente -> insere session extra avec pages", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({
        awaitingResponse: true,
        durationSeconds: 300,
        type: "extra_page",
        args: JSON.stringify({ page: 300 }),
      }),
    );
    const session = makeSession({
      id: 1,
      pageStart: 300,
      pageEnd: 302,
      durationSeconds: 300,
      type: "extra",
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMessageContext("3");
    await timerResponseHandler(ctx, next);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "extra",
        pageStart: 300,
        pageEnd: 302,
      }),
    );
    expect(mockClearTimerState).toHaveBeenCalled();
  });

  it("kahf en attente -> parse count, insere session kahf", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({
        awaitingResponse: true,
        durationSeconds: 300,
        type: "kahf",
        args: "{}",
      }),
    );
    const session = makeSession({
      id: 1,
      pageStart: 293,
      pageEnd: 295,
      type: "kahf",
      durationSeconds: 300,
    });
    mockInsertSession.mockResolvedValue({ ok: true, value: session });

    const ctx = createMessageContext("3");
    await timerResponseHandler(ctx, next);

    expect(mockInsertSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "kahf",
        pageStart: 293,
        pageEnd: 295,
      }),
    );
    expect(mockClearTimerState).toHaveBeenCalled();
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("3/12");
  });

  it("reponse invalide pour normal_page -> erreur, timer reste en attente", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({
        awaitingResponse: true,
        durationSeconds: 300,
        type: "normal_page",
        args: "{}",
      }),
    );

    const ctx = createMessageContext("abc");
    await timerResponseHandler(ctx, next);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("nombre de pages invalide");
    expect(mockClearTimerState).not.toHaveBeenCalled();
    expect(mockInsertSession).not.toHaveBeenCalled();
  });

  it("reponse invalide pour normal_verse -> erreur, timer reste en attente", async () => {
    mockGetTimerState.mockResolvedValue(
      makeTimerState({
        awaitingResponse: true,
        durationSeconds: 300,
        type: "normal_verse",
        args: JSON.stringify({ surah: 2, ayah: 77 }),
      }),
    );

    const ctx = createMessageContext("abc");
    await timerResponseHandler(ctx, next);

    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format de verset invalide");
    expect(mockClearTimerState).not.toHaveBeenCalled();
  });

  it("pas de message text -> next()", async () => {
    const ctx = {
      message: undefined,
      reply: vi.fn(),
      db: {} as D1Database,
      locale: fr,
    } as unknown as CustomContext;
    await timerResponseHandler(ctx, next);
    expect(next).toHaveBeenCalled();
  });
});

describe("goTimerCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetTimerState.mockResolvedValue(undefined);
    vi.mocked(getTimezone).mockResolvedValue("America/Cancun");
    vi.mocked(getNowTimestamp).mockReturnValue("2026-03-15 10:00:00");
  });

  it("demarre un timer normal_page et affiche le clavier Stop", async () => {
    mockGetTimerState.mockResolvedValue(null);
    mockGetLastSession.mockResolvedValue({ pageEnd: 10 } as Session);

    const ctx = createCallbackContext("timer_go");
    await goTimerCallback(ctx);

    expect(mockSetTimerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "normal_page", args: "{}" }),
    );
    const msg = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Timer démarré");
    const opts = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts).toHaveProperty("reply_markup");
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("timer deja actif -> erreur et answerCallbackQuery", async () => {
    const epoch = Date.now() - 300000;
    mockGetTimerState.mockResolvedValue(makeTimerState({ startedEpoch: epoch }));

    const ctx = createCallbackContext("timer_go");
    await goTimerCallback(ctx);

    expect(mockSetTimerState).not.toHaveBeenCalled();
    const msg = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("timer est déjà actif");
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});
