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
    // Per-season balance targets — raw food-min per 48-min cycle. Pre-fire,
    // raw roots are weak (50) — eaten if the day's been hard but mostly
    // stockpiled for the campfire, where roast_root jumps to 100. Eggs are
    // the hidden bonus that makes a slow day still pay.
    //   spring ~63 (lean, but bird_egg picks up some slack)
    //   summer ~77 (berries + eggs)
    //   autumn ~81 raw / ~125 with fire (abundance, stockpile and cook)
    //   winter ~58 (sustenance — save your preserves)
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
      // Year-round bonuses. Eggs are the standout pre-fire calorie source —
      // peak in nesting season, scarce in the cold months. The odd stick
      // off the brushline makes the campfire viable without a dedicated
      // stick run, but stays well below what forest actions return.
      { item: "bird_egg", qty: [1, 1], chance: 0.2, seasons: [0, 1] },
      { item: "bird_egg", qty: [1, 1], chance: 0.1, seasons: [2, 3] },
      { item: "stick", qty: [1, 1], chance: 0.3 },
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
