import type { GatherAction, GatherId } from "./types";

const list: GatherAction[] = [
  {
    id: "fell_tree",
    name: "Fell Tree",
    icon: "🌳",
    description: "Knock down a tree with your hands. A better axe yields more wood.",
    drops: [
      { item: "wood", qty: [1, 2], chance: 1 },
      { item: "wood", qty: [1, 2], chance: 0.5, requiresTool: { type: "axe", minTier: 1 } },
      { item: "wood", qty: [1, 2], chance: 0.5, requiresTool: { type: "axe", minTier: 2 } },
      { item: "apple", qty: [1, 1], chance: 0.1 },
      { item: "wheat_seed", qty: [1, 1], chance: 0.05 },
    ],
  },
  {
    id: "dig_earth",
    name: "Dig Earth",
    icon: "🟫",
    description: "Scoop up earth. Sometimes there's a seed.",
    drops: [
      { item: "dirt", qty: [1, 2], chance: 1 },
      { item: "dirt", qty: [1, 2], chance: 0.5, requiresTool: { type: "shovel", minTier: 1 } },
      { item: "wheat_seed", qty: [1, 1], chance: 0.15 },
      { item: "sunflower_seed", qty: [1, 1], chance: 0.05 },
    ],
  },
  {
    id: "mine_ores",
    name: "Mine Ores",
    icon: "⛰️",
    description:
      "Chip rock loose. Better picks find better ore: tin/copper need a wooden pick, iron needs stone, and richer veins reveal themselves to bronze and iron picks.",
    drops: [
      { item: "stone", qty: [1, 2], chance: 1 },
      { item: "coal_ore", qty: [1, 1], chance: 0.2 },
      // wooden pickaxe unlocks tin & copper
      { item: "tin_ore", qty: [1, 1], chance: 0.1, requiresTool: { type: "pickaxe", minTier: 1 } },
      { item: "copper_ore", qty: [1, 1], chance: 0.1, requiresTool: { type: "pickaxe", minTier: 1 } },
      // stone pickaxe unlocks iron
      { item: "iron_ore", qty: [1, 1], chance: 0.08, requiresTool: { type: "pickaxe", minTier: 2 } },
      // bronze pickaxe: richer copper & tin
      { item: "copper_ore", qty: [1, 2], chance: 0.15, requiresTool: { type: "pickaxe", minTier: 3 } },
      { item: "tin_ore", qty: [1, 2], chance: 0.15, requiresTool: { type: "pickaxe", minTier: 3 } },
      // iron pickaxe: stronger iron yields
      { item: "iron_ore", qty: [1, 2], chance: 0.2, requiresTool: { type: "pickaxe", minTier: 4 } },
    ],
  },
];

export const GATHER_ACTIONS: Record<GatherId, GatherAction> = Object.fromEntries(
  list.map((g) => [g.id, g]),
);
export const ALL_GATHER_ACTIONS: GatherAction[] = list;
