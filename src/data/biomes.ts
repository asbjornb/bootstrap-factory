import type { Biome, BiomeId } from "./types";

const list: Biome[] = [
  {
    id: "forest",
    name: "Forest",
    icon: "🌲",
    description:
      "Mixed woodland — undergrowth, deadfall, standing trees, soil patches, and the odd rocky outcrop. Each foray turns up something different.",
    exploreDurationMs: 2500,
    outcomes: [
      {
        weight: 4,
        message: "You find a stand of trees.",
        charges: [{ node: "tree_node", qty: [3, 6] }],
        drops: [{ item: "stick", qty: [1, 2], chance: 0.5 }],
      },
      {
        weight: 4,
        message: "You wade into a thicket of fibrous undergrowth.",
        charges: [{ node: "fiber_node", qty: [4, 8] }],
        drops: [{ item: "plant_fiber", qty: [1, 1], chance: 0.4 }],
      },
      {
        weight: 3,
        message: "A small clearing with both fallen trunks and tall grasses.",
        charges: [
          { node: "tree_node", qty: [2, 3] },
          { node: "fiber_node", qty: [2, 4] },
        ],
      },
      {
        weight: 4,
        message: "Brush at the wood's edge — sticks underfoot, fiber on every stem.",
        charges: [{ node: "forage_patch", qty: [3, 6] }],
        drops: [
          { item: "stick", qty: [1, 2], chance: 0.6 },
          { item: "plant_fiber", qty: [1, 1], chance: 0.4 },
        ],
      },
      {
        weight: 3,
        message: "You scuff up a patch of soft loam.",
        charges: [{ node: "soil_patch", qty: [4, 7] }],
        drops: [{ item: "loam", qty: [1, 1], chance: 0.4 }],
      },
      {
        weight: 3,
        message: "A rocky outcrop pokes through the leaf litter.",
        charges: [{ node: "rock_outcrop", qty: [3, 6] }],
        drops: [{ item: "rubble", qty: [1, 1], chance: 0.4 }],
      },
      {
        weight: 1,
        message: "You wander a while and turn up nothing useful.",
        charges: [],
      },
    ],
  },
];

export const BIOMES: Record<BiomeId, Biome> = Object.fromEntries(
  list.map((b) => [b.id, b]),
);
export const ALL_BIOMES: Biome[] = list;
