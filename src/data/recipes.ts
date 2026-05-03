import { ITEMS } from "./items";
import type { ItemId, Recipe, RecipeId } from "./types";

const list: Recipe[] = [
  // hand
  {
    id: "planks_from_wood",
    machine: "hand",
    inputs: [{ item: "wood", qty: 1 }],
    outputs: [{ item: "planks", qty: 4 }],
  },
  {
    id: "sticks_from_planks",
    machine: "hand",
    inputs: [{ item: "planks", qty: 2 }],
    outputs: [{ item: "stick", qty: 4 }],
  },
  {
    id: "crafting_table",
    machine: "hand",
    inputs: [{ item: "planks", qty: 4 }],
    outputs: [{ item: "crafting_table", qty: 1 }],
  },

  // crafting table — wooden tools
  {
    id: "wooden_axe",
    machine: "crafting_table",
    inputs: [
      { item: "planks", qty: 3 },
      { item: "stick", qty: 2 },
    ],
    outputs: [{ item: "wooden_axe", qty: 1 }],
  },
  {
    id: "wooden_pickaxe",
    machine: "crafting_table",
    inputs: [
      { item: "planks", qty: 3 },
      { item: "stick", qty: 2 },
    ],
    outputs: [{ item: "wooden_pickaxe", qty: 1 }],
  },
  {
    id: "wooden_shovel",
    machine: "crafting_table",
    inputs: [
      { item: "planks", qty: 1 },
      { item: "stick", qty: 2 },
    ],
    outputs: [{ item: "wooden_shovel", qty: 1 }],
  },

  // workshop blocks
  {
    id: "chest",
    machine: "crafting_table",
    inputs: [{ item: "wood", qty: 8 }],
    outputs: [{ item: "chest", qty: 1 }],
    tool: { type: "axe", minTier: 1 },
  },
  {
    id: "furnace",
    machine: "crafting_table",
    inputs: [{ item: "stone", qty: 8 }],
    outputs: [{ item: "furnace", qty: 1 }],
  },

  // stone tier
  {
    id: "stone_pickaxe",
    machine: "crafting_table",
    inputs: [
      { item: "stone", qty: 3 },
      { item: "stick", qty: 2 },
    ],
    outputs: [{ item: "stone_pickaxe", qty: 1 }],
  },
  {
    id: "stone_axe",
    machine: "crafting_table",
    inputs: [
      { item: "stone", qty: 3 },
      { item: "stick", qty: 2 },
    ],
    outputs: [{ item: "stone_axe", qty: 1 }],
  },

  // furnace
  {
    id: "smelt_coal",
    machine: "furnace",
    inputs: [{ item: "coal_ore", qty: 1 }],
    outputs: [{ item: "coal", qty: 1 }],
  },
  {
    id: "smelt_tin",
    machine: "furnace",
    inputs: [
      { item: "tin_ore", qty: 1 },
      { item: "coal", qty: 1 },
    ],
    outputs: [{ item: "tin_ingot", qty: 1 }],
  },
  {
    id: "smelt_copper",
    machine: "furnace",
    inputs: [
      { item: "copper_ore", qty: 1 },
      { item: "coal", qty: 1 },
    ],
    outputs: [{ item: "copper_ingot", qty: 1 }],
  },
  {
    id: "smelt_iron",
    machine: "furnace",
    inputs: [
      { item: "iron_ore", qty: 1 },
      { item: "coal", qty: 1 },
    ],
    outputs: [{ item: "iron_ingot", qty: 1 }],
  },
  {
    id: "alloy_bronze",
    machine: "furnace",
    inputs: [
      { item: "copper_ingot", qty: 3 },
      { item: "tin_ingot", qty: 1 },
      { item: "coal", qty: 1 },
    ],
    outputs: [{ item: "bronze_ingot", qty: 4 }],
  },

  // bronze tools
  {
    id: "bronze_pickaxe",
    machine: "crafting_table",
    inputs: [
      { item: "bronze_ingot", qty: 3 },
      { item: "stick", qty: 2 },
    ],
    outputs: [{ item: "bronze_pickaxe", qty: 1 }],
  },
  {
    id: "bronze_axe",
    machine: "crafting_table",
    inputs: [
      { item: "bronze_ingot", qty: 3 },
      { item: "stick", qty: 2 },
    ],
    outputs: [{ item: "bronze_axe", qty: 1 }],
  },

  // iron tools
  {
    id: "iron_pickaxe",
    machine: "crafting_table",
    inputs: [
      { item: "iron_ingot", qty: 3 },
      { item: "stick", qty: 2 },
    ],
    outputs: [{ item: "iron_pickaxe", qty: 1 }],
  },

  // misc
  {
    id: "torch",
    machine: "hand",
    inputs: [
      { item: "stick", qty: 1 },
      { item: "coal", qty: 1 },
    ],
    outputs: [{ item: "torch", qty: 4 }],
  },
  {
    id: "bronze_chest",
    machine: "crafting_table",
    inputs: [
      { item: "wood", qty: 8 },
      { item: "bronze_ingot", qty: 4 },
    ],
    outputs: [{ item: "bronze_chest", qty: 1 }],
    tool: { type: "axe", minTier: 3 },
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
