/**
 * Force the Perplexity home page onto Search and verify it. Computer mode is
 * sticky and spends the weekly allowance, so callers must refuse to send
 * when this returns ok:false.
 */
export interface SearchGuardClient {
  bringToFront(): Promise<void>;
  ensureViewport(): Promise<unknown>;
  evaluate(js: string): Promise<{ result: { value?: unknown } }>;
  clickAt(x: number, y: number): Promise<void>;
}

export interface SurfaceState {
  found: boolean;
  pressed?: boolean;
  at?: { x: number; y: number };
}

const surfaceJs = `(() => {
  const vis = (b) => { const r = b.getBoundingClientRect(); return r.width > 0; };
  const b = [...document.querySelectorAll('button')].find((x) => vis(x) && (x.innerText.trim() === 'Search' || x.getAttribute('aria-label') === 'Search'));
  if (!b) return { found: false, w: innerWidth, h: innerHeight, c: [...document.querySelectorAll('button')].filter((x) => /Search|Computer/.test(x.innerText + (x.getAttribute('aria-label') || ''))).map((x) => { const r = x.getBoundingClientRect(); return [x.innerText.trim(), x.getAttribute('aria-label'), Math.round(r.left), Math.round(r.top), Math.round(r.width)]; }) };
  const r = b.getBoundingClientRect();
  const pressed = b.getAttribute('aria-pressed') === 'true';
  if (!pressed) b.click();
  return { found: true, pressed, at: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
})()`;

export async function ensureSearchMode(
  client: SearchGuardClient,
  attempts = 8,
  delayMs = 600,
): Promise<{ ok: boolean; surface: SurfaceState }> {
  await client.bringToFront();
  await client.ensureViewport();
  let surface: SurfaceState = { found: false };
  for (let i = 0; i < attempts; i++) {
    surface = (await client.evaluate(surfaceJs)).result.value as SurfaceState;
    if (surface.found && surface.pressed) break;
    if (surface.found && surface.at && surface.at.y > 0) {
      await client.clickAt(surface.at.x, surface.at.y);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { ok: !!(surface.found && surface.pressed), surface };
}
