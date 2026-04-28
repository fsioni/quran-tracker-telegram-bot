import { describe, expect, it } from "vitest";
import { ar } from "../../src/locales/ar";
import { en } from "../../src/locales/en";
import { fr } from "../../src/locales/fr";
import { renderLoginPage } from "../../src/mcp/auth/pages";

describe("renderLoginPage snapshots", () => {
  for (const [name, t] of [
    ["en", en],
    ["fr", fr],
    ["ar", ar],
  ] as const) {
    it(`request page (${name})`, () => {
      const html = renderLoginPage(t, "request", { signedSessionId: "" });
      expect(html).toMatchSnapshot();
    });
    it(`verify page (${name})`, () => {
      const html = renderLoginPage(t, "verify", {
        signedSessionId: "abc.def",
      });
      expect(html).toMatchSnapshot();
    });
  }
});
