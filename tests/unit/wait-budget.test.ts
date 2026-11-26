import { describe, it, expect } from "vitest";
import { waitBudgetMs } from "../../src/wait-budget.js";

describe("waitBudgetMs", () => {
  it("caps a long request below the default 120 s client limit", () => {
    expect(waitBudgetMs(240000, {})).toBe(108000);
  });
  it("defaults to the cap when no timeout is given", () => {
    expect(waitBudgetMs(undefined, {})).toBe(108000);
  });
  it("keeps a short request as asked", () => {
    expect(waitBudgetMs(60000, {})).toBe(60000);
  });
  it("follows a raised MCP_TOOL_TIMEOUT", () => {
    expect(waitBudgetMs(240000, { MCP_TOOL_TIMEOUT: "300000" })).toBe(240000);
  });
  it("lets COMET_MAX_WAIT_MS override", () => {
    expect(waitBudgetMs(240000, { COMET_MAX_WAIT_MS: "90000" })).toBe(90000);
  });
  it("never goes below 10 s", () => {
    expect(waitBudgetMs(1000, {})).toBe(10000);
  });
});
