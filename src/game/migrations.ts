import { ITEMS } from "../data/items";
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
  // v13 → v14: rename `berries` → `bramble_berries` (the summer variant of
  // the new seasonal berry set). Item id has to be rewritten anywhere it
  // appears as a record key.
  13: (s) => {
    renameItemId(s, "berries", "bramble_berries");
  },
  // v12 → v13: chests now track their own perishable batches. Old saves had
  // no per-chest tracking (chests acted as fridges). Seed each chest's
  // perishable contents with a single batch sized to the current count and
  // a fresh expiry from now — a one-time grace so existing stockpiles
  // don't all expire instantly the moment the player opens the new build.
  12: (s) => {
    const dayLength = typeof s.dayLength === "number" && s.dayLength > 0 ? s.dayLength : 16 * 60;
    const dayNumber = typeof s.dayNumber === "number" && s.dayNumber >= 1 ? s.dayNumber : 1;
    const worldClock = typeof s.worldClock === "number" && s.worldClock >= 0 ? s.worldClock : 0;
    const now = (dayNumber - 1) * dayLength + worldClock;
    if (!Array.isArray(s.rooms)) return;
    for (const r of s.rooms) {
      if (!r || !Array.isArray(r.cells)) continue;
      for (const c of r.cells) {
        if (!c || c.kind !== "chest") continue;
        if (!c.perishables || typeof c.perishables !== "object") c.perishables = {};
        const contents = c.contents ?? {};
        for (const [id, qty] of Object.entries(contents)) {
          if (typeof qty !== "number" || qty <= 0) continue;
          const perish = ITEMS[id]?.spoilsAfter;
          if (!perish) continue;
          if (Array.isArray(c.perishables[id]) && c.perishables[id].length > 0) continue;
          c.perishables[id] = [{ qty, expiresAt: now + perish }];
        }
      }
    }
  },
};

/** Move every record-keyed entry from `from` to `to`, summing on collision. */
function renameItemId(s: any, from: string, to: string): void {
  const moveMap = (m: any): void => {
    if (!m || typeof m !== "object") return;
    if (m[from] === undefined) return;
    m[to] = (m[to] ?? 0) + m[from];
    delete m[from];
  };
  const moveBatches = (m: any): void => {
    if (!m || typeof m !== "object") return;
    const old = m[from];
    if (!Array.isArray(old)) return;
    const merged = Array.isArray(m[to]) ? [...m[to], ...old] : old;
    merged.sort((a: any, b: any) => (a?.expiresAt ?? 0) - (b?.expiresAt ?? 0));
    m[to] = merged;
    delete m[from];
  };
  moveMap(s.inventory);
  moveMap(s.floor);
  moveBatches(s.perishables);
  if (Array.isArray(s.rooms)) {
    for (const r of s.rooms) {
      if (!r || !Array.isArray(r.cells)) continue;
      for (const c of r.cells) {
        if (!c) continue;
        moveMap(c.contents);
        moveBatches(c.perishables);
        moveMap(c.output);
      }
    }
  }
}

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
