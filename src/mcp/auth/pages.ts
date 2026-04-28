import type { Locale } from "../../locales/types";

interface RenderContext {
  signedSessionId: string;
  errorMessage?: string;
  notice?: string;
  redirectQuery?: string;
}

function escape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const baseStyles = `
  body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; max-width: 480px; margin-inline: auto; }
  h1 { font-size: 1.4rem; }
  form { display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; }
  button { padding: 0.75rem 1rem; font-size: 1rem; cursor: pointer; }
  input { padding: 0.75rem; font-size: 1.2rem; letter-spacing: 0.2em; text-align: center; }
  .notice { color: #2a7a2a; }
  .error { color: #b00020; }
`;

export function renderLoginPage(
  t: Locale,
  state: "request" | "verify",
  ctx: RenderContext
): string {
  const action =
    state === "request" ? "/oauth/login/request" : "/oauth/login/verify";
  const inner =
    state === "request"
      ? `
        <p>${escape(t.mcpLogin.intro)}</p>
        <form method="post" action="${action}${ctx.redirectQuery ?? ""}">
          <button type="submit">${escape(t.mcpLogin.sendCodeButton)}</button>
        </form>
      `
      : `
        ${ctx.notice ? `<p class="notice">${escape(ctx.notice)}</p>` : ""}
        ${ctx.errorMessage ? `<p class="error">${escape(ctx.errorMessage)}</p>` : ""}
        <form method="post" action="${action}">
          <input type="hidden" name="session_id" value="${escape(ctx.signedSessionId)}">
          <label for="code">${escape(t.mcpLogin.codeInputLabel)}</label>
          <input id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required>
          <button type="submit">${escape(t.mcpLogin.verifyButton)}</button>
        </form>
      `;
  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(t.mcpLogin.pageTitle)}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <h1>${escape(t.mcpLogin.heading)}</h1>
  ${inner}
</body>
</html>`;
}
