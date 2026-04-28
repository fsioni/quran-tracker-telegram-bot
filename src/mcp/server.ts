import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { DEFAULT_TZ } from "../config";
import { getConfig } from "../services/db/config";
import { McpError } from "./errors";
import { schemaMarkdown } from "./resources/schema-text";
import { getConfigTool } from "./tools/config";
import { getKhatmasTool } from "./tools/khatmas";
import { QuerySqlParams, querySqlTool } from "./tools/query-sql";
import {
  GetJuzPagesParams,
  GetSchemaParams,
  GetSurahsParams,
  getJuzPagesTool,
  getSchemaTool,
  getSurahsTool,
} from "./tools/reference";
import { GetSessionsParams, getSessionsTool } from "./tools/sessions";
import { GetRecentSpeedParams, getRecentSpeedTool } from "./tools/speed";
import {
  GetGlobalStatsParams,
  GetPeriodStatsParams,
  getGlobalStatsTool,
  getPeriodStatsTool,
  getStreakTool,
} from "./tools/stats";

const QUERY_SQL_DESCRIPTION = `Run a read-only SELECT against the user's reading data.

Tables (compact):
- sessions(id, started_at, duration_seconds, page_start, page_end, surah_start, ayah_start, surah_end, ayah_end, ayah_count, type, created_at)
- khatmas(id, completed_at)
- config(key, value)

Rules: SELECT only. No multi-statement. No \`sqlite_*\` tables. LIMIT auto-injected at 500 (max 1000).
Call \`get_schema\` for the full reference.`;

interface Env {
  DB: D1Database;
}

async function loadTz(db: D1Database): Promise<string> {
  return (await getConfig(db, "timezone")) ?? DEFAULT_TZ;
}

function wrapResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function wrapError(code: string, message: string) {
  return {
    isError: true as const,
    content: [
      { type: "text" as const, text: JSON.stringify({ code, message }) },
    ],
  };
}

async function callTool<T>(
  fn: () => Promise<T>
): Promise<ReturnType<typeof wrapResult> | ReturnType<typeof wrapError>> {
  try {
    return wrapResult(await fn());
  } catch (e) {
    if (e instanceof McpError) {
      return wrapError(e.code, e.message);
    }
    console.error("MCP tool error:", e);
    return wrapError("DB_ERROR", e instanceof Error ? e.message : String(e));
  }
}

export function createMcpServer(env: Env): McpServer {
  const server = new McpServer(
    { name: "quran-tracker", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  // --- tools ---

  server.registerTool(
    "get_global_stats",
    {
      description: "Total sessions, ayahs, pages, time across all history.",
      inputSchema: GetGlobalStatsParams.shape,
    },
    async (args) =>
      callTool(() =>
        getGlobalStatsTool({
          db: env.DB,
          params: GetGlobalStatsParams.parse(args),
        })
      )
  );

  server.registerTool(
    "get_period_stats",
    {
      description:
        "Aggregate stats for a week or month, optionally offset back.",
      inputSchema: GetPeriodStatsParams.shape,
    },
    async (args) =>
      callTool(async () =>
        getPeriodStatsTool({
          db: env.DB,
          tz: await loadTz(env.DB),
          params: GetPeriodStatsParams.parse(args),
        })
      )
  );

  server.registerTool(
    "get_streak",
    {
      description: "Current and best consecutive-day streaks.",
    },
    async () =>
      callTool(async () =>
        getStreakTool({ db: env.DB, tz: await loadTz(env.DB) })
      )
  );

  server.registerTool(
    "get_khatmas",
    {
      description: "List of completed khatmas (full Quran reads).",
    },
    async () => callTool(() => getKhatmasTool({ db: env.DB }))
  );

  server.registerTool(
    "get_recent_speed",
    {
      description: "Reading speed over the last N days.",
      inputSchema: GetRecentSpeedParams.shape,
    },
    async (args) =>
      callTool(async () =>
        getRecentSpeedTool({
          db: env.DB,
          tz: await loadTz(env.DB),
          params: GetRecentSpeedParams.parse(args),
        })
      )
  );

  server.registerTool(
    "get_sessions",
    {
      description: "Sessions in a date range. Capped at 200 rows.",
      inputSchema: GetSessionsParams.shape,
    },
    async (args) =>
      callTool(() =>
        getSessionsTool({
          db: env.DB,
          params: GetSessionsParams.parse(args),
        })
      )
  );

  server.registerTool(
    "get_config",
    {
      description: "City, country, timezone, and today's date.",
    },
    async () => callTool(() => getConfigTool({ db: env.DB }))
  );

  server.registerTool(
    "get_surahs",
    {
      description:
        "Surah metadata: id, transliterated name, Arabic name, ayah count.",
      inputSchema: GetSurahsParams.shape,
    },
    async (args) =>
      callTool(() => getSurahsTool({ params: GetSurahsParams.parse(args) }))
  );

  server.registerTool(
    "get_juz_pages",
    {
      description: "Juz to page-range mapping.",
      inputSchema: GetJuzPagesParams.shape,
    },
    async (args) =>
      callTool(() => getJuzPagesTool({ params: GetJuzPagesParams.parse(args) }))
  );

  server.registerTool(
    "get_schema",
    {
      description: "Full database schema documentation in markdown.",
      inputSchema: GetSchemaParams.shape,
    },
    async (args) =>
      callTool(() => getSchemaTool({ params: GetSchemaParams.parse(args) }))
  );

  server.registerTool(
    "query_sql",
    {
      description: QUERY_SQL_DESCRIPTION,
      inputSchema: QuerySqlParams.shape,
    },
    async (args) =>
      callTool(() =>
        querySqlTool({ db: env.DB, params: QuerySqlParams.parse(args) })
      )
  );

  // --- resources ---

  server.registerResource(
    "schema",
    "schema://database",
    {
      title: "Database schema",
      description: "Full database schema and conventions in markdown.",
      mimeType: "text/markdown",
    },
    async (_uri) => ({
      contents: [
        {
          uri: "schema://database",
          mimeType: "text/markdown",
          text: schemaMarkdown,
        },
      ],
    })
  );

  return server;
}

export const mcpApiHandler: ExportedHandler<{ DB: D1Database }> = {
  async fetch(request, env): Promise<Response> {
    const server = createMcpServer({ DB: env.DB });
    const transport = new WebStandardStreamableHTTPServerTransport({
      // Stateless mode: appropriate for Cloudflare Workers (per-request server instances).
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    return await transport.handleRequest(request);
  },
};
