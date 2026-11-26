/**
 * Claude Code ends an MCP tool call at MCP_TOOL_TIMEOUT (120 s on our machines).
 * If comet_ask waits longer than that, the client kills the call and the answer
 * is lost. Cap the whole call below the client limit so comet_ask returns its
 * "still in progress, use comet_poll" result instead, which keeps the answer
 * recoverable.
 */
export const DEFAULT_CLIENT_TIMEOUT_MS = 120000;
export const CLIENT_MARGIN_MS = 12000;

export function waitBudgetMs(
  requested: number | undefined,
  env: { COMET_MAX_WAIT_MS?: string; MCP_TOOL_TIMEOUT?: string } = process.env,
): number {
  const explicit = Number(env.COMET_MAX_WAIT_MS);
  const client = Number(env.MCP_TOOL_TIMEOUT);
  const cap = explicit > 0
    ? explicit
    : (client > 0 ? client : DEFAULT_CLIENT_TIMEOUT_MS) - CLIENT_MARGIN_MS;
  const want = requested && requested > 0 ? requested : DEFAULT_CLIENT_TIMEOUT_MS;
  return Math.max(10000, Math.min(want, cap));
}
