import type { Biome, BiomeId } from "./types";

const list: Biome[] = [
  {
    id: "forest",
    name: "Forest",
    icon: "🌲",
    description:
      "Mixed woodland — undergrowth, deadfall, and standing trees. The familiar wood around the workshop.",
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
        weight: 1,
        message: "You wander a while and turn up nothing useful.",
        charges: [],
      },
    ],
  },
  {
    id: "meadow",
    name: "Meadow",
    icon: "🌾",
    description:
      "Open ground past the trees. Soft loam, the odd patch of clay, seeds catching in the grass.",
    exploreDurationMs: 3000,
    outcomes: [
      {
        weight: 5,
        message: "You scuff up a wide patch of soft loam.",
        charges: [{ node: "soil_patch", qty: [4, 7] }],
        drops: [{ item: "loam", qty: [1, 1], chance: 0.5 }],
      },
      {
        weight: 3,
        message: "Tall grass and turned earth — seeds catch in your sleeves.",
        charges: [{ node: "soil_patch", qty: [2, 4] }],
        drops: [
          { item: "wheat_seed", qty: [1, 1], chance: 0.4 },
          { item: "sunflower_seed", qty: [1, 1], chance: 0.15 },
        ],
      },
      {
        weight: 1,
        message: "Rolling fields, but nothing within reach today.",
        charges: [],
      },
    ],
  },
  {
    id: "foothills",
    name: "Foothills",
    icon: "⛰️",
    description:
      "Stony ground rising toward the hills. Rocky outcrops, loose scree, and the flint and ore that come with them.",
    exploreDurationMs: 3500,
    outcomes: [
      {
        weight: 5,
        message: "A weather-cracked outcrop, ready to be worked.",
        charges: [{ node: "rock_outcrop", qty: [4, 7] }],
        drops: [{ item: "rubble", qty: [1, 1], chance: 0.4 }],
      },
      {
        weight: 3,
        message: "A scree of broken stone — easy pickings underfoot.",
        charges: [{ node: "rock_outcrop", qty: [2, 4] }],
        drops: [
          { item: "rubble", qty: [1, 2], chance: 0.6 },
          { item: "flint", qty: [1, 1], chance: 0.3 },
        ],
      },
      {
        weight: 1,
        message: "Stony ground that yields nothing this time.",
        charges: [],
      },
    ],
  },
];

export const BIOMES: Record<BiomeId, Biome> = Object.fromEntries(
  list.map((b) => [b.id, b]),
);
export const ALL_BIOMES: Biome[] = list;
