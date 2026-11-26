import { describe, it, expect, vi } from "vitest";
import { ensureSearchMode, type SearchGuardClient } from "../../src/search-guard.js";

const fake = (states: unknown[]): SearchGuardClient & { clicks: number } => {
  let i = 0;
  const c = {
    clicks: 0,
    bringToFront: vi.fn(async () => {}),
    ensureViewport: vi.fn(async () => {}),
    evaluate: vi.fn(async () => ({ result: { value: states[Math.min(i++, states.length - 1)] } })),
    clickAt: vi.fn(async () => {
      c.clicks++;
    }),
  };
  return c;
};

describe("ensureSearchMode", () => {
  it("passes immediately when Search is already pressed", async () => {
    const c = fake([{ found: true, pressed: true, at: { x: 5, y: 5 } }]);
    const r = await ensureSearchMode(c, 3, 0);
    expect(r.ok).toBe(true);
    expect(c.clicks).toBe(0);
  });

  it("clicks Computer->Search then confirms", async () => {
    const c = fake([
      { found: true, pressed: false, at: { x: 5, y: 5 } },
      { found: true, pressed: true, at: { x: 5, y: 5 } },
    ]);
    const r = await ensureSearchMode(c, 3, 0);
    expect(r.ok).toBe(true);
    expect(c.clicks).toBe(1);
  });

  it("REFUSES when the Search pill is never found", async () => {
    const c = fake([{ found: false }]);
    const r = await ensureSearchMode(c, 3, 0);
    expect(r.ok).toBe(false);
    expect(c.clicks).toBe(0);
  });

  it("REFUSES when Search never becomes pressed", async () => {
    const c = fake([{ found: true, pressed: false, at: { x: 5, y: 5 } }]);
    const r = await ensureSearchMode(c, 3, 0);
    expect(r.ok).toBe(false);
    expect(c.clicks).toBe(3);
  });

  it("does not click a zero-height (hidden viewport) target", async () => {
    const c = fake([{ found: true, pressed: false, at: { x: 5, y: 0 } }]);
    const r = await ensureSearchMode(c, 2, 0);
    expect(r.ok).toBe(false);
    expect(c.clicks).toBe(0);
  });
});
