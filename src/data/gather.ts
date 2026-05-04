import type { GatherAction, GatherId, ItemId } from "./types";

const list: GatherAction[] = [
  {
    id: "forage_woodland",
    name: "Forage Woodland",
    icon: "🌳",
    description:
      "Walk the treeline gathering logs and fiber. A hatchet fells trees cleaner; a sharper edge finds resin.",
    baseDurationMs: 4500,
    speedups: [
      { type: "axe", minTier: 1, durationMs: 3000 },
      { type: "axe", minTier: 2, durationMs: 2000 },
    ],
    drops: [
      { item: "log", qty: [1, 1], chance: 1 },
      { item: "log", qty: [1, 2], chance: 0.5, requiresTool: { type: "axe", minTier: 1 } },
      { item: "log", qty: [1, 2], chance: 0.5, requiresTool: { type: "axe", minTier: 2 } },
      { item: "plant_fiber", qty: [1, 1], chance: 0.5 },
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
    baseDurationMs: 5000,
    speedups: [
      { type: "shovel", minTier: 1, durationMs: 3200 },
      { type: "shovel", minTier: 2, durationMs: 2200 },
    ],
    drops: [
      { item: "loam", qty: [1, 1], chance: 1 },
      { item: "loam", qty: [1, 2], chance: 0.5, requiresTool: { type: "shovel", minTier: 1 } },
      { item: "clay_lump", qty: [1, 1], chance: 0.2 },
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
      "Pry stone loose from a rocky face. You only pocket what you know what to do with — rubble and flint at first, ores once you have somewhere to smelt them. Better picks chip stone faster and pull more from each swing.",
    baseDurationMs: 6000,
    speedups: [
      { type: "pickaxe", minTier: 1, durationMs: 4000 },
      { type: "pickaxe", minTier: 2, durationMs: 3000 },
      { type: "pickaxe", minTier: 3, durationMs: 2200 },
      { type: "pickaxe", minTier: 4, durationMs: 1600 },
    ],
    drops: [
      { item: "rubble", qty: [1, 1], chance: 1 },
      { item: "fieldstone", qty: [1, 1], chance: 0.3 },
      { item: "flint", qty: [1, 1], chance: 0.18 },
      // copper & tin: only worth picking up once you can smelt them in a kiln.
      { item: "copper_ore", qty: [1, 1], chance: 0.12, requiresMachineEverBuilt: "clay_kiln" },
      { item: "tin_ore", qty: [1, 1], chance: 0.1, requiresMachineEverBuilt: "clay_kiln" },
      // iron & coal: pointless until you have a bloomery hot enough to use them.
      { item: "iron_ore", qty: [1, 1], chance: 0.1, requiresMachineEverBuilt: "bloomery" },
      { item: "coal", qty: [1, 1], chance: 0.15, requiresMachineEverBuilt: "bloomery" },
      // Better picks bite richer pieces out of the same rock.
      { item: "copper_ore", qty: [1, 2], chance: 0.18, requiresMachineEverBuilt: "clay_kiln", requiresTool: { type: "pickaxe", minTier: 3 } },
      { item: "tin_ore", qty: [1, 2], chance: 0.15, requiresMachineEverBuilt: "clay_kiln", requiresTool: { type: "pickaxe", minTier: 3 } },
      { item: "iron_ore", qty: [1, 2], chance: 0.2, requiresMachineEverBuilt: "bloomery", requiresTool: { type: "pickaxe", minTier: 4 } },
      { item: "coal", qty: [1, 2], chance: 0.15, requiresMachineEverBuilt: "bloomery", requiresTool: { type: "pickaxe", minTier: 4 } },
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
