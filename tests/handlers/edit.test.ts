import { describe, expect, it, vi } from "vitest";
import type { CustomContext } from "../../src/bot";
import { editHandler } from "../../src/handlers/edit";
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

const MOCK_UPDATED_ROW = {
  ...MOCK_SESSION_ROW,
  duration_seconds: 900,
};

function createContext(
  match: string,
  firstResults: unknown[] = [null]
): CustomContext {
  let callIndex = 0;
  const firstFn = vi.fn().mockImplementation(() => {
    const result = firstResults[callIndex] ?? null;
    callIndex++;
    return Promise.resolve(result);
  });
  const bindFn = vi
    .fn()
    .mockReturnValue({ run: vi.fn(), first: firstFn, all: vi.fn() });
  const prepareFn = vi.fn().mockReturnValue({
    bind: bindFn,
    run: vi.fn(),
    first: firstFn,
    all: vi.fn(),
  });

  return {
    match,
    reply: vi.fn().mockResolvedValue(undefined),
    chat: { id: 12_345 },
    db: {
      prepare: prepareFn,
      batch: vi.fn(),
      exec: vi.fn(),
      dump: vi.fn(),
    } as unknown as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

describe("editHandler", () => {
  it("repond erreur si pas d'arguments", async () => {
    const ctx = createContext("");
    await editHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("ID ou durée manquants");
  });

  it("repond erreur si duree manquante", async () => {
    const ctx = createContext("42");
    await editHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("ID ou durée manquants");
  });

  it("repond erreur si ID non numerique", async () => {
    const ctx = createContext("abc 15m");
    await editHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("ID invalide");
  });

  it("repond erreur si ID est zero", async () => {
    const ctx = createContext("0 15m");
    await editHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("ID invalide");
  });

  it("repond erreur si duree invalide", async () => {
    const ctx = createContext("42 xyz");
    await editHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
  });

  it("repond erreur si session introuvable", async () => {
    const ctx = createContext("99 15m", [null]);
    await editHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("n'existe pas");
  });

  it("modifie la duree et affiche ancien/nouveau", async () => {
    const ctx = createContext("42 15m", [MOCK_SESSION_ROW, MOCK_UPDATED_ROW]);
    await editHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Session #42 modifiée.");
    expect(msg).toContain("Al-Baqara 2:77-83");
    expect(msg).toContain("8m53");
    expect(msg).toContain("15m");
  });
});
