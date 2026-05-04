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
];

export const NODES: Record<NodeId, ResourceNode> = Object.fromEntries(
  list.map((n) => [n.id, n]),
);
export const ALL_NODES: ResourceNode[] = list;

/** All resource nodes that can drop the given item. */
export function nodesProducing(itemId: ItemId): ResourceNode[] {
  return list.filter((n) => n.drops.some((d) => d.item === itemId));
}
