/**
 * Time scale between real seconds and in-world minutes.
 *
 * One in-world day is 16 hours = 960 minutes. A full day of work
 * costs ~2 minutes of real action time, giving:
 *   1 real second = 8 in-world minutes  (480x speedup)
 *
 * Action data files declare their real-time duration in milliseconds
 * (`baseDurationMs` / `exploreDurationMs`). The corresponding in-world
 * `activeTime` (minutes) is derived from that via `realMsToGameMinutes`
 * unless a data entry overrides it explicitly.
 */
export const GAME_MINUTES_PER_REAL_SECOND = 8;

/** Convert a real-time duration (ms) to in-world minutes, rounded, min 1. */
export function realMsToGameMinutes(ms: number): number {
  return Math.max(1, Math.round((ms / 1000) * GAME_MINUTES_PER_REAL_SECOND));
}
