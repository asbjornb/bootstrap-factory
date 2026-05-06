import { ITEMS } from "./items";
import { isTagInput } from "./types";
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
      "Walk the edges of camp turning over leaves and stripping low brambles. Slow but always available — what's in the basket depends on the season.",
    baseDurationMs: 6000,
    activeTime: 48,
    // Per-season balance targets (food-min per 48-min cycle):
    //   spring ~60 (lean, ~80% time = self-sustain)
    //   summer ~72 (~67%)
    //   autumn ~96 (~50% — abundance, time to stockpile)
    //   winter ~54 (~89% — sustenance only, save your preserves)
    drops: [
      // Spring
      { item: "spring_shoots", qty: [1, 2], chance: 0.8, seasons: [0] },
      { item: "edible_root", qty: [1, 2], chance: 0.4, seasons: [0] },
      { item: "plant_fiber", qty: [1, 1], chance: 0.3, seasons: [0] },
      // Summer
      { item: "bramble_berries", qty: [1, 3], chance: 0.8, seasons: [1] },
      { item: "edible_root", qty: [1, 1], chance: 0.4, seasons: [1] },
      { item: "plant_fiber", qty: [1, 1], chance: 0.2, seasons: [1] },
      // Autumn
      { item: "elderberries", qty: [1, 2], chance: 0.7, seasons: [2] },
      { item: "edible_root", qty: [1, 2], chance: 0.6, seasons: [2] },
      { item: "plant_fiber", qty: [1, 1], chance: 0.2, seasons: [2] },
      // Winter
      { item: "pine_bark", qty: [1, 2], chance: 0.8, seasons: [3] },
      { item: "frozen_tuber", qty: [1, 1], chance: 0.6, seasons: [3] },
      { item: "plant_fiber", qty: [1, 1], chance: 0.15, seasons: [3] },
    ],
  },
  {
    id: "distant_foray",
    name: "Distant Foray",
    icon: "🥾",
    description:
      "Pack a ration and strike out for the further bramble-and-marsh country. A long day, but you come back with the basket full.",
    baseDurationMs: 14000,
    activeTime: 112,
    provisions: [{ tag: "ration", qty: 1 }],
    drops: [
      // Berry slot — tracks the season's dominant fruit. Spring/winter fall back to roots/bark below.
      { item: "bramble_berries", qty: [3, 6], chance: 1, seasons: [1] },
      { item: "elderberries", qty: [3, 6], chance: 1, seasons: [2] },
      { item: "spring_shoots", qty: [3, 6], chance: 0.9, seasons: [0] },
      { item: "pine_bark", qty: [3, 6], chance: 0.9, seasons: [3] },
      // Roots — soft autumn ground digs best, frozen winter ground worst.
      { item: "edible_root", qty: [2, 4], chance: 0.9, seasons: [0, 1, 2] },
      { item: "frozen_tuber", qty: [1, 3], chance: 0.7, seasons: [3] },
      // Year-round materials
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

/**
 * Gather actions whose provisions accept the given tag — either directly
 * (TagInput on this tag) or via a Stack provision whose item carries the tag.
 */
export function gatherActionsRequiringTag(tag: string): GatherAction[] {
  return list.filter((g) =>
    g.provisions?.some((p) =>
      isTagInput(p) ? p.tag === tag : ITEMS[p.item]?.tags?.includes(tag),
    ),
  );
}

/**
 * Gather actions whose provisions accept the given item — either as a direct
 * Stack input or via a TagInput matching one of the item's tags.
 */
export function gatherActionsRequiringItem(itemId: ItemId): GatherAction[] {
  const tags = ITEMS[itemId]?.tags ?? [];
  return list.filter((g) =>
    g.provisions?.some((p) =>
      isTagInput(p) ? tags.includes(p.tag) : p.item === itemId,
    ),
  );
}
