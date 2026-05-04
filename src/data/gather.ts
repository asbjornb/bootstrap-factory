import type { GatherAction, GatherId, ItemId } from "./types";

// All gathering happens via finite ResourceNodes discovered through exploration.
// This list is intentionally empty — the system is kept available for future
// always-on actions that aren't really "gathering" (e.g. tinkering, resting).
const list: GatherAction[] = [];

export const GATHER_ACTIONS: Record<GatherId, GatherAction> = Object.fromEntries(
  list.map((g) => [g.id, g]),
);
export const ALL_GATHER_ACTIONS: GatherAction[] = list;

/** All gather actions that can drop the given item. */
export function gatherActionsProducing(itemId: ItemId): GatherAction[] {
  return list.filter((g) => g.drops.some((d) => d.item === itemId));
}
