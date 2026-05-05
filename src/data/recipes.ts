import { hasTag, ITEMS } from "./items";
import { isTagInput } from "./types";
import type { ItemId, Recipe, RecipeId } from "./types";

const list: Recipe[] = [
  // ---- by hand ----
  {
    id: "split_log",
    machine: "hand",
    inputs: [{ item: "log", qty: 1 }],
    outputs: [{ item: "board", qty: 4 }],
  },
  {
    id: "twist_cordage",
    machine: "hand",
    inputs: [{ item: "plant_fiber", qty: 2 }],
    outputs: [{ item: "cordage", qty: 1 }],
  },
  {
    id: "shape_haft",
    machine: "hand",
    inputs: [
      { item: "board", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "haft", qty: 2 }],
  },
  {
    id: "lash_haft",
    machine: "hand",
    inputs: [
      { item: "stick", qty: 2 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "haft", qty: 1 }],
  },
  {
    id: "mix_daub",
    machine: "hand",
    inputs: [
      { item: "clay_lump", qty: 2 },
      { item: "loam", qty: 1 },
      { item: "plant_fiber", qty: 1 },
    ],
    outputs: [{ item: "daub", qty: 4 }],
  },
  {
    id: "workbench",
    machine: "hand",
    inputs: [{ item: "board", qty: 4 }],
    outputs: [{ item: "workbench", qty: 1 }],
  },
  {
    id: "charcoal_pit",
    machine: "hand",
    inputs: [
      { item: "fieldstone", qty: 8 },
      { item: "daub", qty: 2 },
    ],
    outputs: [{ item: "charcoal_pit", qty: 1 }],
  },
  {
    id: "bow_drill",
    machine: "hand",
    inputs: [
      { item: "stick", qty: 2 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "bow_drill", qty: 1 }],
  },
  {
    id: "campfire",
    machine: "hand",
    inputs: [
      { item: "fieldstone", qty: 4 },
      { item: "stick", qty: 2 },
      { item: "bow_drill", qty: 1 },
    ],
    outputs: [{ item: "campfire", qty: 1 }],
  },

  // ---- workbench: flint tools ----
  {
    id: "flint_hatchet",
    machine: "workbench",
    inputs: [
      { item: "flint", qty: 2 },
      { item: "haft", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "flint_hatchet", qty: 1 }],
    durationMs: 1500,
  },
  {
    id: "flint_pick",
    machine: "workbench",
    inputs: [
      { item: "flint", qty: 2 },
      { item: "haft", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "flint_pick", qty: 1 }],
    durationMs: 1500,
  },
  {
    id: "flint_shovel",
    machine: "workbench",
    inputs: [
      { item: "flint", qty: 1 },
      { item: "haft", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "flint_shovel", qty: 1 }],
    durationMs: 1200,
  },

  // ---- workbench: workshop blocks ----
  {
    id: "crate",
    machine: "workbench",
    inputs: [
      { item: "board", qty: 6 },
      { tag: "cordage", qty: 2 },
    ],
    outputs: [{ item: "crate", qty: 1 }],
    tool: { type: "axe", minTier: 1 },
    durationMs: 2500,
  },
  {
    id: "clay_kiln",
    machine: "workbench",
    inputs: [
      { item: "fieldstone", qty: 12 },
      { item: "daub", qty: 6 },
    ],
    outputs: [{ item: "clay_kiln", qty: 1 }],
    durationMs: 4000,
  },
  {
    id: "bloomery",
    machine: "workbench",
    inputs: [
      { item: "clay_brick", qty: 16 },
      { item: "fieldstone", qty: 8 },
      { tag: "cordage", qty: 4 },
    ],
    outputs: [{ item: "bloomery", qty: 1 }],
    durationMs: 6000,
  },

  // ---- workbench: copper tools ----
  {
    id: "copper_axe",
    machine: "workbench",
    inputs: [
      { item: "copper_ingot", qty: 3 },
      { item: "haft", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "copper_axe", qty: 1 }],
    durationMs: 2500,
  },
  {
    id: "copper_pick",
    machine: "workbench",
    inputs: [
      { item: "copper_ingot", qty: 3 },
      { item: "haft", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "copper_pick", qty: 1 }],
    durationMs: 2500,
  },
  {
    id: "copper_shovel",
    machine: "workbench",
    inputs: [
      { item: "copper_ingot", qty: 1 },
      { item: "haft", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "copper_shovel", qty: 1 }],
    durationMs: 2000,
  },

  // ---- workbench: bronze tools ----
  {
    id: "bronze_axe",
    machine: "workbench",
    inputs: [
      { item: "bronze_ingot", qty: 3 },
      { item: "haft", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "bronze_axe", qty: 1 }],
    durationMs: 3000,
  },
  {
    id: "bronze_pick",
    machine: "workbench",
    inputs: [
      { item: "bronze_ingot", qty: 3 },
      { item: "haft", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "bronze_pick", qty: 1 }],
    durationMs: 3000,
  },

  // ---- workbench: iron tools ----
  {
    id: "iron_axe",
    machine: "workbench",
    inputs: [
      { item: "iron_ingot", qty: 3 },
      { item: "haft", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "iron_axe", qty: 1 }],
    durationMs: 3500,
  },
  {
    id: "iron_pick",
    machine: "workbench",
    inputs: [
      { item: "iron_ingot", qty: 3 },
      { item: "haft", qty: 1 },
      { tag: "cordage", qty: 1 },
    ],
    outputs: [{ item: "iron_pick", qty: 1 }],
    durationMs: 3500,
  },

  // ---- workbench: bound crate ----
  {
    id: "bound_crate",
    machine: "workbench",
    inputs: [
      { item: "board", qty: 8 },
      { item: "bronze_ingot", qty: 2 },
      { tag: "cordage", qty: 2 },
    ],
    outputs: [{ item: "bound_crate", qty: 1 }],
    tool: { type: "axe", minTier: 3 },
    durationMs: 4000,
  },

  // ---- workbench: drying rack ----
  {
    id: "drying_rack",
    machine: "workbench",
    inputs: [
      { item: "stick", qty: 6 },
      { tag: "cordage", qty: 3 },
    ],
    outputs: [{ item: "drying_rack", qty: 1 }],
    durationMs: 2500,
  },

  // ---- workbench: tilled plot ----
  // Stake out a bed of turned soil. The shovel is the gate — bare hands
  // make daub, not a furrow.
  {
    id: "tilled_plot",
    machine: "workbench",
    inputs: [
      { item: "board", qty: 4 },
      { item: "loam", qty: 4 },
    ],
    outputs: [{ item: "tilled_plot", qty: 1 }],
    tool: { type: "shovel", minTier: 1 },
    durationMs: 2500,
  },

  // ---- workbench: oil press ----
  // First non-tool use of bronze: a screw and a bed heavy enough to crush
  // sunflower heads without splintering.
  {
    id: "oil_press",
    machine: "workbench",
    inputs: [
      { item: "board", qty: 6 },
      { tag: "cordage", qty: 2 },
      { item: "bronze_ingot", qty: 2 },
    ],
    outputs: [{ item: "oil_press", qty: 1 }],
    tool: { type: "axe", minTier: 2 },
    durationMs: 4500,
  },

  // ---- workbench: retting pit ----
  // A clay-lined hollow held shallow with water. Fieldstone for the rim,
  // daub to seal the seam — a water-themed counterpart to the kiln.
  {
    id: "retting_pit",
    machine: "workbench",
    inputs: [
      { item: "fieldstone", qty: 6 },
      { item: "daub", qty: 4 },
    ],
    outputs: [{ item: "retting_pit", qty: 1 }],
    tool: { type: "shovel", minTier: 1 },
    durationMs: 4000,
  },

  // ---- agriculture: hand ----
  // Stone-and-pestle milling. Slow and tactile; later eclipsed by a millstone.
  {
    id: "mill_flour",
    machine: "hand",
    inputs: [{ item: "wheat_grain", qty: 2 }],
    outputs: [{ item: "flour", qty: 1 }],
  },
  // Linen thread off the distaff. Long fibers spin clean — one pull, one thread.
  {
    id: "spin_thread",
    machine: "hand",
    inputs: [{ item: "retted_flax", qty: 1 }],
    outputs: [{ item: "linen_thread", qty: 1 }],
  },
  // Plied thread becomes rope. Stronger than wild-fiber twist and counts
  // as cordage anywhere a recipe asks for it.
  {
    id: "twist_strong_cordage",
    machine: "hand",
    inputs: [{ item: "linen_thread", qty: 2 }],
    outputs: [{ item: "strong_cordage", qty: 1 }],
  },

  // ---- tilled plot ----
  // Wheat: spring sowing, ~most-of-a-day to mature. Returns the seed plus a
  // small grain harvest, so a single seed both feeds and re-seeds.
  // goToSeedDays: leave the harvest sitting too long and the grain gets
  // taken by birds/sprout/rot — only the seed remains. See sleep().
  {
    id: "plant_wheat",
    machine: "tilled_plot",
    inputs: [{ item: "wheat_seed", qty: 1 }],
    outputs: [
      { item: "wheat_grain", qty: 3 },
      { item: "wheat_seed", qty: 1 },
    ],
    seasons: [0],
    durationMs: 90000,
    goToSeedDays: 2,
  },
  // Sunflower: summer sowing, autumn ripeness. Heads go to the press, seed
  // returns for next year's planting.
  {
    id: "plant_sunflower",
    machine: "tilled_plot",
    inputs: [{ item: "sunflower_seed", qty: 1 }],
    outputs: [
      { item: "sunflower_head", qty: 4 },
      { item: "sunflower_seed", qty: 1 },
    ],
    seasons: [1],
    durationMs: 110000,
    goToSeedDays: 2,
  },
  // Flax: spring sowing, summer pull. Stalks go to the retting pit; one seed
  // back so the line keeps itself.
  {
    id: "plant_flax",
    machine: "tilled_plot",
    inputs: [{ item: "flax_seed", qty: 1 }],
    outputs: [
      { item: "flax_stalks", qty: 6 },
      { item: "flax_seed", qty: 1 },
    ],
    seasons: [0],
    durationMs: 100000,
    goToSeedDays: 2,
  },

  // ---- oil press ----
  // Heads in, oil and cake out. Cake is mealy food, oil is for everything
  // that comes later (lamps, frying, bearings).
  {
    id: "press_oil",
    machine: "oil_press",
    inputs: [{ item: "sunflower_head", qty: 4 }],
    outputs: [
      { item: "sunflower_oil", qty: 1 },
      { item: "seedcake", qty: 2 },
    ],
    durationMs: 5000,
  },

  // ---- retting pit ----
  // A long soak that softens the bast away from the woody stem. Two stalks
  // make one usable bundle of fiber.
  {
    id: "ret_flax",
    machine: "retting_pit",
    inputs: [{ item: "flax_stalks", qty: 2 }],
    outputs: [{ item: "retted_flax", qty: 1 }],
    durationMs: 12000,
  },

  // ---- campfire: bread ----
  {
    id: "bake_bread",
    machine: "campfire",
    inputs: [
      { item: "flour", qty: 1 },
      { item: "stick", qty: 1 },
    ],
    outputs: [{ item: "bread", qty: 1 }],
    durationMs: 4000,
  },

  // ---- drying rack ----
  {
    id: "dry_berries",
    machine: "drying_rack",
    inputs: [{ tag: "berry", qty: 3 }],
    outputs: [{ item: "dried_berries", qty: 1 }],
    durationMs: 5000,
  },
  {
    id: "dry_root",
    machine: "drying_rack",
    inputs: [{ item: "edible_root", qty: 2 }],
    outputs: [{ item: "dried_root", qty: 1 }],
    durationMs: 6000,
  },

  // ---- campfire ----
  // Cooking returns more food value than the raw input because heat
  // gelatinises starch and breaks cell walls — calories the gut couldn't
  // reach before. Each cook burns one stick as fuel.
  {
    id: "roast_root",
    machine: "campfire",
    inputs: [
      { item: "edible_root", qty: 1 },
      { item: "stick", qty: 1 },
    ],
    outputs: [{ item: "roast_root", qty: 1 }],
    durationMs: 3000,
  },
  {
    id: "roast_tuber",
    machine: "campfire",
    inputs: [
      { item: "frozen_tuber", qty: 1 },
      { item: "stick", qty: 1 },
    ],
    outputs: [{ item: "roast_tuber", qty: 1 }],
    durationMs: 3000,
  },
  {
    id: "wilt_greens",
    machine: "campfire",
    inputs: [
      { item: "spring_shoots", qty: 1 },
      { item: "stick", qty: 1 },
    ],
    outputs: [{ item: "wilted_greens", qty: 1 }],
    durationMs: 2000,
  },

  // ---- charcoal pit ----
  {
    id: "burn_charcoal",
    machine: "charcoal_pit",
    inputs: [{ item: "log", qty: 2 }],
    outputs: [{ item: "charcoal", qty: 3 }],
    durationMs: 8000,
  },

  // ---- clay kiln ----
  {
    id: "fire_brick",
    machine: "clay_kiln",
    inputs: [
      { item: "clay_lump", qty: 2 },
      { item: "charcoal", qty: 1 },
    ],
    outputs: [{ item: "clay_brick", qty: 2 }],
    durationMs: 3000,
  },
  {
    id: "fire_crucible",
    machine: "clay_kiln",
    inputs: [
      { item: "clay_brick", qty: 2 },
      { item: "daub", qty: 1 },
      { item: "charcoal", qty: 1 },
    ],
    outputs: [{ item: "crucible", qty: 1 }],
    durationMs: 4000,
  },
  {
    id: "smelt_copper",
    machine: "clay_kiln",
    inputs: [
      { item: "copper_ore", qty: 1 },
      { item: "charcoal", qty: 1 },
    ],
    outputs: [{ item: "copper_ingot", qty: 1 }],
    durationMs: 4000,
  },
  {
    id: "smelt_tin",
    machine: "clay_kiln",
    inputs: [
      { item: "tin_ore", qty: 1 },
      { item: "charcoal", qty: 1 },
    ],
    outputs: [{ item: "tin_ingot", qty: 1 }],
    durationMs: 4000,
  },
  {
    id: "alloy_bronze",
    machine: "clay_kiln",
    inputs: [
      { item: "copper_ingot", qty: 3 },
      { item: "tin_ingot", qty: 1 },
      { item: "charcoal", qty: 1 },
      { item: "crucible", qty: 1 },
    ],
    outputs: [{ item: "bronze_ingot", qty: 4 }],
    durationMs: 6000,
  },

  // ---- clay kiln: pottery vessels ----
  // A fired jar — cool, dark, lidded. Stretches the shelf life of anything
  // stored inside it well past what a shelf or a wooden crate manages.
  {
    id: "fire_clay_jar",
    machine: "clay_kiln",
    inputs: [
      { item: "clay_lump", qty: 3 },
      { item: "charcoal", qty: 1 },
    ],
    outputs: [{ item: "clay_jar", qty: 1 }],
    durationMs: 4000,
  },

  // ---- campfire: seal a jar ----
  // Melt pine resin around the lid rim. The pitch sets airtight; what was
  // a slow leak becomes a stoppered vessel. Long-haul preservation.
  {
    id: "seal_jar",
    machine: "campfire",
    inputs: [
      { item: "clay_jar", qty: 1 },
      { item: "resin", qty: 1 },
      { item: "stick", qty: 1 },
    ],
    outputs: [{ item: "sealed_jar", qty: 1 }],
    durationMs: 3000,
  },

  // ---- bloomery ----
  {
    id: "smelt_iron",
    machine: "bloomery",
    inputs: [
      { item: "iron_ore", qty: 1 },
      { item: "charcoal", qty: 2 },
    ],
    outputs: [{ item: "iron_ingot", qty: 1 }],
    durationMs: 6000,
  },

  // ---- carry gear ----
  {
    id: "belt_pouch",
    machine: "workbench",
    inputs: [
      { item: "board", qty: 2 },
      { tag: "cordage", qty: 4 },
    ],
    outputs: [{ item: "belt_pouch", qty: 1 }],
    durationMs: 1500,
  },
  {
    id: "haul_pack",
    machine: "workbench",
    inputs: [
      { item: "board", qty: 4 },
      { tag: "cordage", qty: 6 },
    ],
    outputs: [{ item: "haul_pack", qty: 1 }],
    tool: { type: "axe", minTier: 1 },
    durationMs: 2500,
  },
];

export const RECIPES: Record<RecipeId, Recipe> = Object.fromEntries(list.map((r) => [r.id, r]));
export const ALL_RECIPES: Recipe[] = list;

/** All recipes that PRODUCE the given item. */
export function recipesProducing(itemId: ItemId): Recipe[] {
  return list.filter((r) => r.outputs.some((o) => o.item === itemId));
}

/** All recipes that CONSUME the given item as an input — directly or via a matching tag. */
export function recipesConsuming(itemId: ItemId): Recipe[] {
  return list.filter((r) =>
    r.inputs.some((i) =>
      isTagInput(i) ? hasTag(itemId, i.tag) : i.item === itemId,
    ),
  );
}

/** Recipes whose tool requirement is satisfied by the given item (must itself be a tool). */
export function recipesUsingAsTool(itemId: ItemId): Recipe[] {
  const tool = ITEMS[itemId]?.tool;
  if (!tool) return [];
  return list.filter(
    (r) => r.tool !== undefined && r.tool.type === tool.type && tool.tier >= r.tool.minTier,
  );
}

/** Recipes that are crafted at the given item (when the item is also a machine, e.g. campfire). */
export function recipesUsingAsMachine(itemId: ItemId): Recipe[] {
  return list.filter((r) => r.machine === itemId);
}
