import type { Biome, BiomeId } from "./types";

const list: Biome[] = [
  {
    id: "forest",
    name: "Forest",
    icon: "🌲",
    description:
      "Mixed woodland — undergrowth, deadfall, and standing trees. Good chance of finding something to chop or strip.",
    exploreDurationMs: 2500,
    outcomes: [
      {
        weight: 4,
        message: "You find a stand of trees.",
        charges: [{ node: "tree_node", qty: [3, 6] }],
      },
      {
        weight: 4,
        message: "You wade into a thicket of fibrous undergrowth.",
        charges: [{ node: "fiber_node", qty: [4, 8] }],
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
