import type { GatherAction, GatherId } from "./types";

const list: GatherAction[] = [
  {
    id: "forage_woodland",
    name: "Forage Woodland",
    icon: "🌳",
    description:
      "Walk the treeline gathering logs and fiber. A hatchet fells trees cleaner; a sharper edge finds resin.",
    drops: [
      { item: "log", qty: [1, 2], chance: 1 },
      { item: "log", qty: [1, 2], chance: 0.5, requiresTool: { type: "axe", minTier: 1 } },
      { item: "log", qty: [1, 2], chance: 0.5, requiresTool: { type: "axe", minTier: 2 } },
      { item: "plant_fiber", qty: [1, 2], chance: 0.6 },
      { item: "plant_fiber", qty: [1, 2], chance: 0.4, requiresTool: { type: "axe", minTier: 1 } },
      { item: "resin", qty: [1, 1], chance: 0.08, requiresTool: { type: "axe", minTier: 2 } },
    ],
  },
  {
    id: "turn_soil",
    name: "Turn Soil",
    icon: "🟤",
    description:
      "Break ground for loam and clay. A shovel works the deeper layers and brings up more clay.",
    drops: [
      { item: "loam", qty: [1, 2], chance: 1 },
      { item: "loam", qty: [1, 2], chance: 0.5, requiresTool: { type: "shovel", minTier: 1 } },
      { item: "clay_lump", qty: [1, 1], chance: 0.25 },
      { item: "clay_lump", qty: [1, 2], chance: 0.25, requiresTool: { type: "shovel", minTier: 2 } },
      { item: "wheat_seed", qty: [1, 1], chance: 0.15 },
      { item: "sunflower_seed", qty: [1, 1], chance: 0.05 },
    ],
  },
  {
    id: "quarry_outcrop",
    name: "Quarry Outcrop",
    icon: "⛰️",
    description:
      "Pry stone loose from a rocky face. Bare hands turn up rubble, fieldstone, and the occasional flint nodule. Better picks reveal deeper ores: copper and tin under a flint pick, iron and coal under copper, richer veins under bronze and iron.",
    drops: [
      { item: "rubble", qty: [1, 2], chance: 1 },
      { item: "fieldstone", qty: [1, 1], chance: 0.45 },
      { item: "flint", qty: [1, 1], chance: 0.25 },
      // flint pick unlocks copper & tin
      { item: "copper_ore", qty: [1, 1], chance: 0.12, requiresTool: { type: "pickaxe", minTier: 1 } },
      { item: "tin_ore", qty: [1, 1], chance: 0.1, requiresTool: { type: "pickaxe", minTier: 1 } },
      // copper pick unlocks iron & coal
      { item: "iron_ore", qty: [1, 1], chance: 0.1, requiresTool: { type: "pickaxe", minTier: 2 } },
      { item: "coal", qty: [1, 1], chance: 0.15, requiresTool: { type: "pickaxe", minTier: 2 } },
      // bronze pick: richer copper & tin
      { item: "copper_ore", qty: [1, 2], chance: 0.18, requiresTool: { type: "pickaxe", minTier: 3 } },
      { item: "tin_ore", qty: [1, 2], chance: 0.15, requiresTool: { type: "pickaxe", minTier: 3 } },
      // iron pick: richer iron & coal
      { item: "iron_ore", qty: [1, 2], chance: 0.2, requiresTool: { type: "pickaxe", minTier: 4 } },
      { item: "coal", qty: [1, 2], chance: 0.15, requiresTool: { type: "pickaxe", minTier: 4 } },
    ],
  },
];

export const GATHER_ACTIONS: Record<GatherId, GatherAction> = Object.fromEntries(
  list.map((g) => [g.id, g]),
);
export const ALL_GATHER_ACTIONS: GatherAction[] = list;
