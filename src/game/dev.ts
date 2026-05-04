/**
 * Speeds up every in-game duration when the page is opened with ?dev.
 * Use ?dev for a sensible default (50x), or ?dev=N to set the multiplier
 * directly (e.g. ?dev=0.01 for 100x, ?dev=1 for normal speed).
 *
 * Apply by multiplying any `durationMs` by `DURATION_SCALE` at the point
 * we compute an `endsAt`, so the saved state never bakes in dev timings.
 */
function readScale(): number {
  if (typeof window === "undefined") return 1;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("dev")) return 1;
  const raw = params.get("dev");
  if (raw === null || raw === "") return 0.02;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0.02;
  return n;
}

export const DURATION_SCALE = readScale();
export const DEV_MODE = DURATION_SCALE !== 1;

if (DEV_MODE && typeof console !== "undefined") {
  console.info(`[dev] duration scale = ${DURATION_SCALE} (durations ${(1 / DURATION_SCALE).toFixed(1)}x faster)`);
}
