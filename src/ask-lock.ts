/**
 * One Comet browser, many callers (several Claude sessions, the comet-ask CLI).
 * Two comet_ask calls at once type into the same tab and read each other's
 * answers, so comet_ask holds a machine-wide lock file while it runs.
 */
import { openSync, closeSync, writeFileSync, readFileSync, unlinkSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const LOCK_PATH = join(tmpdir(), "comet-bridge-ask.lock");
export const STALE_MS = 5 * 60 * 1000;

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e: any) { return e?.code === "EPERM"; }
}

export function tryAcquire(path = LOCK_PATH, now = Date.now()): boolean {
  try {
    const fd = openSync(path, "wx");
    writeFileSync(fd, JSON.stringify({ pid: process.pid, at: now }));
    closeSync(fd);
    return true;
  } catch (e: any) {
    if (e?.code !== "EEXIST") throw e;
    let holder: { pid?: number; at?: number } = {};
    try { holder = JSON.parse(readFileSync(path, "utf8")); } catch { /* half-written: judge by mtime */ }
    const at = holder.at ?? statSync(path).mtimeMs;
    const dead = holder.pid !== undefined && holder.pid !== process.pid && !pidAlive(holder.pid);
    if (dead || now - at > STALE_MS) {
      try { unlinkSync(path); } catch { /* another caller cleared it */ }
      return tryAcquire(path, now);
    }
    return false;
  }
}

export function release(path = LOCK_PATH): void {
  try {
    const holder = JSON.parse(readFileSync(path, "utf8"));
    if (holder.pid === process.pid) unlinkSync(path);
  } catch { /* already gone */ }
}

export async function acquire(waitMs: number, path = LOCK_PATH, stepMs = 1000): Promise<boolean> {
  const end = Date.now() + waitMs;
  for (;;) {
    if (tryAcquire(path)) return true;
    if (Date.now() >= end) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}
