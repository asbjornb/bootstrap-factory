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
    // Active hunting. The spear is the gate; without one this slot stays
    // dark. A trip is long and miss-prone — many trips come back with a
    // handful of sticks and a story — but a kill is a stack of raw meat,
    // and once the campfire's lit raw meat cooks down to a multiple of its
    // raw food value. This is where cooking finally pays.
    id: "stalk_game",
    name: "Stalk Game",
    icon: "🦌",
    description:
      "Hold the spear low and follow the brush trails. Long, often a wasted afternoon — but a kill is many days of food, especially once you have a fire to cook it on.",
    baseDurationMs: 9000,
    activeTime: 80,
    requiresTool: { type: "spear", minTier: 1 },
    drops: [
      // Primary kill: ~70% of trips return at least 1 raw meat.
      { item: "raw_meat", qty: [1, 3], chance: 0.7 },
      // Clean-hit bonus on top — turns a good kill into a great one.
      { item: "raw_meat", qty: [1, 2], chance: 0.3 },
      // The hide off a kill. Stash for the leather pass.
      { item: "hide", qty: [1, 1], chance: 0.4 },
      // Incidental forage on the way back.
      { item: "stick", qty: [1, 2], chance: 0.5 },
      { item: "plant_fiber", qty: [1, 1], chance: 0.3 },
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
