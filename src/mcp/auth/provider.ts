import { OAuthProvider } from "@cloudflare/workers-oauth-provider";

interface Handlers {
  apiHandler: ExportedHandler;
  defaultHandler: ExportedHandler;
}

export function createOAuthProvider(handlers: Handlers): OAuthProvider {
  return new OAuthProvider({
    apiRoute: ["/mcp/"],
    apiHandler: handlers.apiHandler as ExportedHandler &
      Pick<Required<ExportedHandler>, "fetch">,
    defaultHandler: handlers.defaultHandler,
    authorizeEndpoint: "/oauth/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    scopesSupported: ["mcp:read"],
    accessTokenTTL: 60 * 60, // 1 hour
    refreshTokenTTL: 30 * 24 * 60 * 60, // 30 days
  });
}
