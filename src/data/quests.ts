import type { Quest, QuestId } from "./types";

export const ALL_QUESTS: Quest[] = [
  {
    id: "flint_shovel",
    title: "Knap a flint shovel",
    description:
      "Hands turn soil slowly and the clay sits out of reach. A flake of flint lashed to a haft would change that — knap one at the workbench.",
    kind: "utility",
    benefit: "Faster soil turning and a real shot at clay.",
    requires: ["flint_shovel"],
    visible: () => true,
    done: (ctx) => ctx.has("flint_shovel"),
  },
  {
    id: "belt_pouch",
    title: "Stitch a belt pouch",
    description:
      "Pockets full, hands fuller. A few boards and a length of cordage make a belt with proper loops — room for the next handful of rocks.",
    kind: "utility",
    benefit: "+4 inventory slots while carried.",
    requires: ["belt_pouch"],
    visible: () => true,
    done: (ctx) => ctx.has("belt_pouch"),
  },
  {
    id: "campfire",
    title: "Light a campfire",
    description:
      "Raw forage burns through the day faster than it fills it. Spin a bow drill to coax a coal, ring it in fieldstone, and feed it sticks — heat unlocks calories the raw food keeps to itself.",
    kind: "utility",
    benefit: "Unlocks roasting roots, tubers, and greens — meaningfully more food per harvest.",
    requires: ["campfire"],
    visible: () => true,
    done: (ctx) => ctx.has("campfire"),
  },
  {
    id: "drying_rack",
    title: "Raise a drying rack",
    description:
      "Berries spoil within a day; roots not much longer. Lash sticks and cordage into an open-air rack and turn raw forage into food that travels.",
    kind: "utility",
    benefit: "Unlocks dried berries and dried roots — preserved food for long expeditions.",
    requires: ["drying_rack"],
    visible: () => true,
    done: (ctx) => ctx.has("drying_rack"),
  },
  {
    id: "clay_kiln",
    title: "Build a clay kiln",
    description:
      "Sun-dried daub will not hold a smelt. Stack fieldstone, pack daub, and raise a kiln hot enough to fire bricks and coax metal out of ore.",
    kind: "progression",
    benefit: "Unlocks fired bricks, crucibles, and copper/tin/bronze smelting.",
    requires: ["clay_kiln"],
    visible: () => true,
    done: (ctx) => ctx.has("clay_kiln"),
  },
  {
    id: "tilled_plot",
    title: "Turn a plot",
    description:
      "Forage takes what the season gives. A bed of worked soil takes a seed in spring and gives back wheat by harvest — and one of those seeds for next year. Build a tilled plot at the workbench.",
    kind: "progression",
    benefit: "Unlocks planting wheat: a renewable food chain past forage.",
    requires: ["tilled_plot"],
    visible: () => true,
    done: (ctx) => ctx.has("tilled_plot"),
  },
  {
    id: "bake_bread",
    title: "Bake the first loaf",
    description:
      "Wheat is gritty. Mill it to flour, take it to the campfire with a stick of fuel, and bake bread — the first food that travels and keeps without giving up its calories.",
    kind: "utility",
    benefit: "A long-lived, calorie-dense food for expeditions and lean weeks.",
    requires: ["bread"],
    visible: () => true,
    done: (ctx) => ctx.has("bread"),
  },
];

export const QUESTS: Record<QuestId, Quest> = Object.fromEntries(
  ALL_QUESTS.map((q) => [q.id, q]),
);
