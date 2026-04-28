import { getLocale } from "../../locales";
import { getConfig } from "../../services/db/config";
import { renderLoginPage } from "./pages";

const SIX_DIGIT_CODE_RE = /^\d{6}$/;
import {
  bumpAttempts,
  checkAndBumpRateLimit,
  deleteLoginSession,
  generateCode,
  getLoginSession,
  hashCode,
  newSessionId,
  putLoginSession,
  signSessionId,
  verifySessionId,
} from "./session";
import { sendTelegramCode } from "./telegram-code";

// Minimal subset of @cloudflare/workers-oauth-provider's OAuthHelpers we use.
// Full type lives in node_modules/@cloudflare/workers-oauth-provider/oauth-provider.d.ts
export interface OAuthHelpers {
  completeAuthorization(opts: {
    request: unknown;
    userId: string;
    scope: string[];
    props: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<{ redirectTo: string }>;
  parseAuthRequest(request: Request): Promise<unknown>;
}

interface Env {
  ALLOWED_USER_ID: string;
  BOT_TOKEN: string;
  DB: D1Database;
  MCP_SESSION_HMAC_SECRET: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
}

async function loadLocale(db: D1Database) {
  const lang = await getConfig(db, "language");
  return getLocale(lang);
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function handleAuthorize(
  request: Request,
  env: Env
): Promise<Response> {
  const t = await loadLocale(env.DB);
  // Validate the auth request now to reject malformed requests early; the parsed info will be re-parsed in /oauth/login/request.
  await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const url = new URL(request.url);
  const redirectQuery = url.search;
  return htmlResponse(
    renderLoginPage(t, "request", { signedSessionId: "", redirectQuery })
  );
}

export async function handleLoginRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const t = await loadLocale(env.DB);
  const ip = request.headers.get("cf-connecting-ip") ?? "0.0.0.0";

  const rate = await checkAndBumpRateLimit(env.OAUTH_KV, ip);
  if (!rate.allowed) {
    return htmlResponse(
      renderLoginPage(t, "request", {
        signedSessionId: "",
        errorMessage: t.mcpLogin.errorRateLimited(rate.minutesUntilReset),
      }),
      429
    );
  }

  // Parse the authorization request. This is needed to forward the parsed shape to completeAuthorization later.
  // We re-parse on the POST because the original GET to /oauth/authorize had the same query string forwarded by the form action.
  const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const code = generateCode();
  const codeHash = await hashCode(code, env.MCP_SESSION_HMAC_SECRET);
  const sessionId = newSessionId();
  await putLoginSession(env.OAUTH_KV, sessionId, {
    oauthReqInfo,
    codeHash,
    attempts: 0,
    createdAt: Math.floor(Date.now() / 1000),
  });

  const sent = await sendTelegramCode(
    env.BOT_TOKEN,
    env.ALLOWED_USER_ID,
    code,
    t
  );
  if (!sent) {
    await deleteLoginSession(env.OAUTH_KV, sessionId);
    return htmlResponse(
      renderLoginPage(t, "request", {
        signedSessionId: "",
        errorMessage: t.mcpLogin.errorTelegramSend,
      }),
      502
    );
  }

  const signed = await signSessionId(sessionId, env.MCP_SESSION_HMAC_SECRET);
  return htmlResponse(
    renderLoginPage(t, "verify", {
      signedSessionId: signed,
      notice: t.mcpLogin.codeSentNotice,
    })
  );
}

export async function handleLoginVerify(
  request: Request,
  env: Env
): Promise<Response> {
  const t = await loadLocale(env.DB);
  const form = await request.formData();
  const signed = form.get("session_id");
  const submitted = form.get("code");

  const sessionId =
    typeof signed === "string"
      ? await verifySessionId(signed, env.MCP_SESSION_HMAC_SECRET)
      : null;
  if (!sessionId) {
    return htmlResponse(
      renderLoginPage(t, "request", {
        signedSessionId: "",
        errorMessage: t.mcpLogin.errorExpired,
      }),
      400
    );
  }

  const rec = await getLoginSession(env.OAUTH_KV, sessionId);
  if (!rec) {
    return htmlResponse(
      renderLoginPage(t, "request", {
        signedSessionId: "",
        errorMessage: t.mcpLogin.errorExpired,
      }),
      400
    );
  }

  if (typeof submitted !== "string" || !SIX_DIGIT_CODE_RE.test(submitted)) {
    return htmlResponse(
      renderLoginPage(t, "verify", {
        signedSessionId: signed as string,
        errorMessage: t.mcpLogin.errorWrongCode(3 - rec.attempts),
      }),
      400
    );
  }

  const submittedHash = await hashCode(submitted, env.MCP_SESSION_HMAC_SECRET);
  if (submittedHash !== rec.codeHash) {
    const remaining = await bumpAttempts(env.OAUTH_KV, sessionId, rec);
    if (remaining <= 0) {
      return htmlResponse(
        renderLoginPage(t, "request", {
          signedSessionId: "",
          errorMessage: t.mcpLogin.errorExpired,
        }),
        400
      );
    }
    return htmlResponse(
      renderLoginPage(t, "verify", {
        signedSessionId: signed as string,
        errorMessage: t.mcpLogin.errorWrongCode(remaining),
      }),
      400
    );
  }

  await deleteLoginSession(env.OAUTH_KV, sessionId);
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: rec.oauthReqInfo,
    userId: env.ALLOWED_USER_ID,
    scope: ["mcp:read"],
    props: { userId: env.ALLOWED_USER_ID },
  });
  return Response.redirect(redirectTo, 302);
}
