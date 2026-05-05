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
];

export const QUESTS: Record<QuestId, Quest> = Object.fromEntries(
  ALL_QUESTS.map((q) => [q.id, q]),
);
