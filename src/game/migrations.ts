import type { GameState } from "./state";

/**
 * Each entry migrates a save FROM that version TO version+1. To add a
 * breaking change: bump SCHEMA_VERSION in state.ts, then add an entry here
 * keyed by the old version that mutates `s` into the new shape.
 *
 * Migrations should be permissive — saved data may be missing fields the
 * current types require. Cast through `any` where needed and let the
 * defensive defaulting in `load()` fill remaining gaps.
 */
type Migration = (s: any) => void;

const MIGRATIONS: Record<number, Migration> = {
  // v9 → v10: introduce time-budget / day-clock fields. Defaults filled in
  // by load() are sufficient; this entry just acknowledges the bump.
  9: (_s) => {},
  // v10 → v11: introduce perishables map and season index. Defaults filled
  // in by load() are sufficient.
  10: (_s) => {},
  // v11 → v12: perishables changed from a single timestamp per item to a
  // FIFO list of {qty, expiresAt} batches. Old saves had one timer covering
  // the whole stack — collapse that into a single batch holding the
  // current inventory + floor total.
  11: (s) => {
    const old = s.perishables;
    if (!old || typeof old !== "object") {
      s.perishables = {};
      return;
    }
    const next: Record<string, { qty: number; expiresAt: number }[]> = {};
    for (const [id, t] of Object.entries(old)) {
      if (typeof t !== "number") continue;
      const qty = (s.inventory?.[id] ?? 0) + (s.floor?.[id] ?? 0);
      if (qty <= 0) continue;
      next[id] = [{ qty, expiresAt: t }];
    }
    s.perishables = next;
  },
};

export interface MigrationResult {
  state: any;
  migrated: boolean;
  fromVersion: number;
  toVersion: number;
}

export function migrate(raw: any, currentVersion: number): MigrationResult | null {
  if (!raw || typeof raw !== "object") return null;
  const from = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
  if (from > currentVersion) return null; // save from the future — refuse
  let v = from;
  while (v < currentVersion) {
    const step = MIGRATIONS[v];
    if (!step) return null; // missing migration — caller should reset
    step(raw);
    v += 1;
    raw.schemaVersion = v;
  }
  return { state: raw as GameState, migrated: from !== currentVersion, fromVersion: from, toVersion: currentVersion };
}
