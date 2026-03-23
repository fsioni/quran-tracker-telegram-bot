// tests/handlers/import.test.ts
import { describe, expect, it, vi } from "vitest";
import type { CustomContext } from "../../src/bot";
import { importHandler } from "../../src/handlers/import";
import { fr } from "../../src/locales/fr";

function createMockContext(match = ""): CustomContext {
  const bindFn = vi.fn().mockReturnValue({});
  const prepareFn = vi.fn().mockReturnValue({ bind: bindFn });
  const batchFn = vi.fn().mockResolvedValue([]);

  return {
    match,
    reply: vi.fn().mockResolvedValue(undefined),
    chat: { id: 12_345 },
    db: {
      prepare: prepareFn,
      batch: batchFn,
      exec: vi.fn(),
      dump: vi.fn(),
    } as unknown as D1Database,
    locale: fr,
  } as unknown as CustomContext;
}

describe("importHandler", () => {
  it("importe une seule ligne valide", async () => {
    const ctx = createMockContext("10/03, 13h30 - 8m53 - 2:77-83");
    await importHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("1 session importée");
    expect(ctx.db.batch).toHaveBeenCalled();
  });

  it("importe plusieurs lignes valides", async () => {
    const ctx = createMockContext(
      "10/03, 13h30 - 8m53 - 2:77-83\n09/03, 20h15 - 12m10 - 2:60-76"
    );
    await importHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("2 sessions importées");
  });

  it("rapporte les erreurs par ligne", async () => {
    const ctx = createMockContext("invalid line");
    await importHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Aucune session importée");
    expect(msg).toContain("1 erreur");
    expect(msg).toContain("Ligne 1");
  });

  it("gere un mix de lignes valides et invalides", async () => {
    const ctx = createMockContext(
      "10/03, 13h30 - 8m53 - 2:77-83\ninvalid\n09/03, 20h15 - 12m10 - 2:60-76"
    );
    await importHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("2 sessions importées");
    expect(msg).toContain("1 erreur");
    expect(msg).toContain("Ligne 2");
  });

  it("repond erreur si aucune donnee", async () => {
    const ctx = createMockContext("");
    await importHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Erreur");
    expect(msg).toContain("aucune donnée");
  });

  it("filtre les lignes vides", async () => {
    const ctx = createMockContext("\n10/03, 13h30 - 8m53 - 2:77-83\n\n");
    await importHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("1 session importée");
  });

  it("n'appelle pas db.batch si toutes les lignes sont invalides", async () => {
    const ctx = createMockContext("invalid");
    await importHandler(ctx);
    expect(ctx.db.batch).not.toHaveBeenCalled();
  });

  it("rapporte les erreurs de validation de range", async () => {
    const ctx = createMockContext("10/03, 13h30 - 8m53 - 0:1-5");
    await importHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Ligne 1");
    expect(msg).toContain("n'existe pas");
  });

  it("importe avec type 'extra' quand la premiere ligne est 'extra'", async () => {
    const ctx = createMockContext("extra\n10/03, 13h30 - 8m53 - 2:77-83");
    await importHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("1 session importée");
    expect(ctx.db.batch).toHaveBeenCalled();
  });

  it("importe avec type 'normal' par defaut (pas de prefixe extra)", async () => {
    const ctx = createMockContext("10/03, 13h30 - 8m53 - 2:77-83");
    await importHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("1 session importée");
  });

  it("rapporte les numeros de ligne originaux avec prefixe extra", async () => {
    const ctx = createMockContext(
      "extra\ninvalid line\n10/03, 13h30 - 8m53 - 2:77-83"
    );
    await importHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("Ligne 2");
    expect(msg).not.toContain("Ligne 1");
  });

  it("importe plusieurs lignes avec type 'extra'", async () => {
    const ctx = createMockContext(
      "extra\n10/03, 13h30 - 8m53 - 2:77-83\n09/03, 20h15 - 12m10 - 2:60-76"
    );
    await importHandler(ctx);
    const msg = (ctx.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(msg).toContain("2 sessions importées");
  });
});
