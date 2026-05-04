import type { GatherAction, GatherId, ItemId } from "./types";

// Always-on gather actions with no node and no charges. The "Forage
// Nearby" action is the always-available floor of the food loop —
// once the hunger system lands, this is what guarantees the player
// can never be fully bricked.
const list: GatherAction[] = [
  {
    id: "forage_nearby",
    name: "Forage Nearby",
    icon: "🫐",
    description:
      "Walk the edges of camp turning over leaves and stripping low brambles. Slow but always available.",
    baseDurationMs: 6000,
    activeTime: 15,
    drops: [
      { item: "berries", qty: [1, 2], chance: 0.7 },
      { item: "edible_root", qty: [1, 1], chance: 0.35 },
      { item: "plant_fiber", qty: [1, 1], chance: 0.2 },
    ],
  },
  {
    id: "distant_foray",
    name: "Distant Foray",
    icon: "🥾",
    description:
      "Pack a ration and strike out for the further bramble-and-marsh country. A long day, but you come back with the basket full.",
    baseDurationMs: 14000,
    activeTime: 4 * 60,
    provisions: [{ item: "dried_berries", qty: 1 }],
    drops: [
      { item: "berries", qty: [3, 6], chance: 1 },
      { item: "edible_root", qty: [2, 4], chance: 0.9 },
      { item: "plant_fiber", qty: [2, 4], chance: 0.7 },
      { item: "stick", qty: [2, 4], chance: 0.6 },
      { item: "resin", qty: [1, 1], chance: 0.15 },
    ],
  },
];

export const GATHER_ACTIONS: Record<GatherId, GatherAction> = Object.fromEntries(
  list.map((g) => [g.id, g]),
);
export const ALL_GATHER_ACTIONS: GatherAction[] = list;

/** All gather actions that can drop the given item. */
export function gatherActionsProducing(itemId: ItemId): GatherAction[] {
  return list.filter((g) => g.drops.some((d) => d.item === itemId));
}
