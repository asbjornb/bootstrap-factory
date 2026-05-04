import { ITEMS } from "./items";
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
      { item: "cordage", qty: 1 },
    ],
    outputs: [{ item: "haft", qty: 2 }],
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

  // ---- workbench: flint tools ----
  {
    id: "flint_hatchet",
    machine: "workbench",
    inputs: [
      { item: "flint", qty: 2 },
      { item: "haft", qty: 1 },
      { item: "cordage", qty: 1 },
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
      { item: "cordage", qty: 1 },
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
      { item: "cordage", qty: 1 },
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
      { item: "cordage", qty: 2 },
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
      { item: "cordage", qty: 4 },
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
      { item: "cordage", qty: 1 },
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
      { item: "cordage", qty: 1 },
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
      { item: "cordage", qty: 1 },
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
      { item: "cordage", qty: 1 },
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
      { item: "cordage", qty: 1 },
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
      { item: "cordage", qty: 1 },
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
      { item: "cordage", qty: 1 },
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
      { item: "cordage", qty: 2 },
    ],
    outputs: [{ item: "bound_crate", qty: 1 }],
    tool: { type: "axe", minTier: 3 },
    durationMs: 4000,
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
];

export const RECIPES: Record<RecipeId, Recipe> = Object.fromEntries(list.map((r) => [r.id, r]));
export const ALL_RECIPES: Recipe[] = list;

/** All recipes that PRODUCE the given item. */
export function recipesProducing(itemId: ItemId): Recipe[] {
  return list.filter((r) => r.outputs.some((o) => o.item === itemId));
}

/** All recipes that CONSUME the given item as an input. */
export function recipesConsuming(itemId: ItemId): Recipe[] {
  return list.filter((r) => r.inputs.some((i) => i.item === itemId));
}

/** Recipes whose tool requirement is satisfied by the given item (must itself be a tool). */
export function recipesUsingAsTool(itemId: ItemId): Recipe[] {
  const tool = ITEMS[itemId]?.tool;
  if (!tool) return [];
  return list.filter(
    (r) => r.tool !== undefined && r.tool.type === tool.type && tool.tier >= r.tool.minTier,
  );
}
