// tests/handlers/manage.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  undoHandler,
  deleteHandler,
  confirmDeleteCallback,
  cancelDeleteCallback,
} from "../../src/handlers/manage";
import type { CustomContext } from "../../src/bot";
import { fr } from "../../src/locales/fr";

const MOCK_SESSION_ROW = {
  id: 42,
  started_at: "2026-03-10 13:30:00",
  duration_seconds: 533,
  surah_start: 2,
  ayah_start: 77,
  surah_end: 2,
  ayah_end: 83,
  ayah_count: 7,
  created_at: "2026-03-10 13:30:00",
};

function createCommandContext(match = "", firstResult: unknown = null): CustomContext {
  const firstFn = vi.fn().mockResolvedValue(firstResult);
  const bindFn = vi.fn().mockReturnValue({ run: vi.fn(), first: firstFn, all: vi.fn() });
  const prepareFn = vi.fn().mockReturnValue({ bind: bindFn, run: vi.fn(), first: firstFn, all: vi.fn() });

  return {
    match,
    reply: vi.fn().mockResolvedValue(undefined),
    chat: { id: 12345 },
    db: {
      prepare: prepareFn,
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn(),
    } as unknown as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

function createCallbackContext(data: string, sessionRow: unknown = null): CustomContext {
  const firstFn = vi.fn().mockResolvedValue(sessionRow);
  const bindFn = vi.fn().mockReturnValue({ run: vi.fn(), first: firstFn, all: vi.fn() });
  const prepareFn = vi.fn().mockReturnValue({ bind: bindFn, run: vi.fn(), first: firstFn, all: vi.fn() });

  return {
    callbackQuery: { data },
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    db: {
      prepare: prepareFn,
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn(),
    } as unknown as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

describe("undoHandler", () => {
  it("repond 'Aucune session' si aucune session", async () => {
    const ctx = createCommandContext("", null);
    await undoHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith("Aucune session à annuler.");
  });

  it("affiche la confirmation avec boutons inline", async () => {
    const ctx = createCommandContext("", MOCK_SESSION_ROW);
    await undoHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [msg, opts] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(msg).toContain("Supprimer la session #42");
    expect(msg).toContain("Al-Baqara 2:77-83");
    expect(opts).toHaveProperty("reply_markup");
  });
});

describe("deleteHandler", () => {
  it("repond erreur si pas d'ID", async () => {
    const ctx = createCommandContext("", null);
    await deleteHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("ID manquant");
  });

  it("repond erreur si ID non numerique", async () => {
    const ctx = createCommandContext("abc", null);
    await deleteHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("ID invalide");
  });

  it("repond erreur si ID est zero", async () => {
    const ctx = createCommandContext("0", null);
    await deleteHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("ID invalide");
  });

  it("repond erreur si session introuvable", async () => {
    const ctx = createCommandContext("99", null);
    await deleteHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("n'existe pas");
  });

  it("affiche la confirmation si session trouvee", async () => {
    const ctx = createCommandContext("42", MOCK_SESSION_ROW);
    await deleteHandler(ctx);
    const [msg, opts] = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(msg).toContain("Supprimer la session #42");
    expect(opts).toHaveProperty("reply_markup");
  });
});

describe("confirmDeleteCallback", () => {
  it("supprime la session et affiche les details", async () => {
    const ctx = createCallbackContext("delete_confirm:42", MOCK_SESSION_ROW);
    await confirmDeleteCallback(ctx);
    const msg = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session #42 supprimée.");
    expect(msg).toContain("Al-Baqara 2:77-83");
    expect(msg).toContain("7 versets");
    expect(msg).toContain("8m53");
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("affiche introuvable si deja supprimee", async () => {
    const ctx = createCallbackContext("delete_confirm:42", null);
    await confirmDeleteCallback(ctx);
    expect(ctx.editMessageText).toHaveBeenCalledWith("Session #42 introuvable.");
  });
});

describe("cancelDeleteCallback", () => {
  it("edite le message avec annulation", async () => {
    const ctx = createCallbackContext("delete_cancel:42");
    await cancelDeleteCallback(ctx);
    expect(ctx.editMessageText).toHaveBeenCalledWith("Suppression annulée.");
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});
