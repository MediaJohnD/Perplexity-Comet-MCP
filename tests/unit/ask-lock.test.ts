import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { tryAcquire, release, acquire, STALE_MS } from "../../src/ask-lock.js";

const p = join(tmpdir(), `ask-lock-test-${process.pid}.lock`);
afterEach(() => { try { unlinkSync(p); } catch {} });

describe("ask lock", () => {
  it("acquires a free lock and releases it", () => {
    expect(tryAcquire(p)).toBe(true);
    expect(existsSync(p)).toBe(true);
    release(p);
    expect(existsSync(p)).toBe(false);
  });
  it("refuses a lock held by a live process", () => {
    writeFileSync(p, JSON.stringify({ pid: process.ppid, at: Date.now() }));
    expect(tryAcquire(p)).toBe(false);
  });
  it("takes over a lock whose holder is dead", () => {
    writeFileSync(p, JSON.stringify({ pid: 999999, at: Date.now() }));
    expect(tryAcquire(p)).toBe(true);
  });
  it("takes over a stale lock", () => {
    writeFileSync(p, JSON.stringify({ pid: process.ppid, at: Date.now() - STALE_MS - 1 }));
    expect(tryAcquire(p)).toBe(true);
  });
  it("does not release another process's lock", () => {
    writeFileSync(p, JSON.stringify({ pid: process.ppid, at: Date.now() }));
    release(p);
    expect(existsSync(p)).toBe(true);
  });
  it("acquire gives up after the wait", async () => {
    writeFileSync(p, JSON.stringify({ pid: process.ppid, at: Date.now() }));
    expect(await acquire(300, p, 100)).toBe(false);
  });
});
