import type { ItemId, NodeId, ResourceNode } from "./types";

const list: ResourceNode[] = [
  {
    id: "tree_node",
    name: "Chop Tree",
    icon: "🌳",
    biome: "forest",
    description:
      "A sound trunk found while exploring. An axe cuts cleaner; a sharper edge finds resin.",
    requiresTool: { type: "axe", minTier: 1 },
    baseDurationMs: 5000,
    speedups: [
      { type: "axe", minTier: 1, durationMs: 3000 },
      { type: "axe", minTier: 2, durationMs: 2000 },
    ],
    drops: [
      { item: "log", qty: [1, 1], chance: 1 },
      { item: "log", qty: [1, 2], chance: 0.5, requiresTool: { type: "axe", minTier: 1 } },
      { item: "log", qty: [1, 2], chance: 0.5, requiresTool: { type: "axe", minTier: 2 } },
      { item: "resin", qty: [1, 1], chance: 0.08, requiresTool: { type: "axe", minTier: 2 } },
    ],
  },
  {
    id: "fiber_node",
    name: "Gather Plant Fiber",
    icon: "🌿",
    biome: "forest",
    description: "A patch of tough undergrowth. Strip stems and bark for fiber.",
    baseDurationMs: 3000,
    speedups: [
      { type: "axe", minTier: 1, durationMs: 2200 },
      { type: "axe", minTier: 2, durationMs: 1600 },
    ],
    drops: [
      { item: "plant_fiber", qty: [1, 2], chance: 1 },
      { item: "plant_fiber", qty: [1, 2], chance: 0.5, requiresTool: { type: "axe", minTier: 1 } },
    ],
  },
  {
    id: "forage_patch",
    name: "Forage",
    icon: "🍂",
    biome: "forest",
    description:
      "Brush and deadfall worth picking over — sticks, the odd handful of fiber, sometimes a length of log.",
    baseDurationMs: 3000,
    drops: [
      { item: "stick", qty: [1, 2], chance: 0.8 },
      { item: "plant_fiber", qty: [1, 1], chance: 0.5 },
      { item: "log", qty: [1, 1], chance: 0.15 },
    ],
  },
  {
    id: "soil_patch",
    name: "Turn Soil",
    icon: "🟤",
    biome: "meadow",
    description:
      "Open ground for loam and clay. A shovel works the deeper layers and brings up more clay.",
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
    id: "rock_outcrop",
    name: "Quarry Outcrop",
    icon: "⛰️",
    biome: "foothills",
    description:
      "A rocky face poking through the loam. Better picks chip stone faster and bite richer pieces from each swing.",
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

export const NODES: Record<NodeId, ResourceNode> = Object.fromEntries(
  list.map((n) => [n.id, n]),
);
export const ALL_NODES: ResourceNode[] = list;

/** All resource nodes that can drop the given item. */
export function nodesProducing(itemId: ItemId): ResourceNode[] {
  return list.filter((n) => n.drops.some((d) => d.item === itemId));
}
