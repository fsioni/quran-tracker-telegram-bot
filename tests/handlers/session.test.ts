// tests/handlers/session.test.ts
import { describe, it, expect, vi } from "vitest";
import { sessionHandler } from "../../src/handlers/session";
import type { CustomContext } from "../../src/bot";
import { fr } from "../../src/locales/fr";

function createMockContext(match = ""): CustomContext {
  const firstFn = vi.fn().mockResolvedValue({
    id: 1,
    started_at: "2026-03-13 14:00:00",
    duration_seconds: 533,
    surah_start: 2,
    ayah_start: 77,
    surah_end: 2,
    ayah_end: 83,
    ayah_count: 7,
    created_at: "2026-03-13 14:00:00",
  });
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

describe("sessionHandler", () => {
  it("enregistre une session same-surah et repond avec confirmation", async () => {
    const ctx = createMockContext("2:77-83 8m53");
    await sessionHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session enregistree");
    expect(msg).toContain("Al-Baqara");
    expect(msg).toContain("7 versets");
  });

  it("repond erreur sans arguments", async () => {
    const ctx = createMockContext("");
    await sessionHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("/session 2:77-83 8m53");
  });

  it("repond erreur si duree manquante", async () => {
    const ctx = createMockContext("2:77-83");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
  });

  it("repond erreur pour format de plage invalide", async () => {
    const ctx = createMockContext("invalid 8m53");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format de plage invalide");
  });

  it("repond erreur pour format de duree invalide", async () => {
    const ctx = createMockContext("2:77-83 8min");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("format de duree invalide");
  });

  it("repond erreur pour sourate hors bornes", async () => {
    const ctx = createMockContext("115:1-5 8m");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("n'existe pas");
  });

  it("repond erreur pour verset hors bornes", async () => {
    const ctx = createMockContext("1:1-99 8m");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("n'a que");
  });

  it("repond erreur pour plage inversee", async () => {
    const ctx = createMockContext("2:83-77 8m");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("precede le debut");
  });

  it("enregistre une session cross-surah", async () => {
    const ctx = createMockContext("2:280-3:10 8m53");
    // Override mock pour cross-surah
    const firstFn = vi.fn().mockResolvedValue({
      id: 2,
      started_at: "2026-03-13 14:00:00",
      duration_seconds: 533,
      surah_start: 2,
      ayah_start: 280,
      surah_end: 3,
      ayah_end: 10,
      ayah_count: 17,
      created_at: "2026-03-13 14:00:00",
    });
    const bindFn = vi.fn().mockReturnValue({ run: vi.fn(), first: firstFn, all: vi.fn() });
    (ctx.db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn, run: vi.fn(), first: firstFn, all: vi.fn() });

    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session enregistree");
    expect(msg).toContain("Al-Baqara");
    expect(msg).toContain("Al-Imran");
    expect(msg).toContain("17 versets");
  });

  it("n'appelle pas db.prepare pour les erreurs de format", async () => {
    const ctx = createMockContext("");
    await sessionHandler(ctx);
    expect(ctx.db.prepare).not.toHaveBeenCalled();
  });

  it("appelle db.prepare pour une session valide", async () => {
    const ctx = createMockContext("2:77-83 8m53");
    await sessionHandler(ctx);
    expect(ctx.db.prepare).toHaveBeenCalled();
  });

  it("session completant une sourate -> message de fin", async () => {
    const ctx = createMockContext("1:1-7 5m");
    const firstFn = vi.fn().mockResolvedValue({
      id: 10,
      started_at: "2026-03-15 14:00:00",
      duration_seconds: 300,
      surah_start: 1,
      ayah_start: 1,
      surah_end: 1,
      ayah_end: 7,
      ayah_count: 7,
      created_at: "2026-03-15 14:00:00",
    });
    const bindFn = vi.fn().mockReturnValue({ run: vi.fn(), first: firstFn, all: vi.fn() });
    (ctx.db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ bind: bindFn, run: vi.fn(), first: firstFn, all: vi.fn() });

    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session enregistree");
    expect(msg).toContain("Sourate Al-Fatiha (1) terminee");
  });

  it("session en milieu de sourate -> pas de message de fin", async () => {
    const ctx = createMockContext("2:100-150 8m");
    await sessionHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("Session enregistree");
    expect(msg).not.toContain("terminee");
  });
});
