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
    done: (ctx) => ctx.has("flint_shovel"),
  },
  {
    id: "belt_pouch",
    title: "Stitch a belt pouch",
    description:
      "Pockets full, hands fuller. A few boards and a length of cordage make a belt with proper loops — room for the next handful of rocks.",
    kind: "utility",
    benefit: "+2 inventory slots while carried. Stacks with a haul pack.",
    requires: ["belt_pouch"],
    done: (ctx) => ctx.has("belt_pouch"),
  },
  {
    id: "haul_pack",
    title: "Lash up a haul pack",
    description:
      "A pouch keeps a handful, but the trip back from the outcrop wants more. Take an axe to a few boards, ply in a length of cordage, and shoulder a proper pack — the kind that carries a day's haul in one trip.",
    kind: "utility",
    benefit: "+6 inventory slots while carried. Stacks with the belt pouch.",
    requires: ["haul_pack"],
    prereq: ["belt_pouch"],
    done: (ctx) => ctx.has("haul_pack"),
  },
  {
    id: "campfire",
    title: "Light a campfire",
    description:
      "Raw forage burns through the day faster than it fills it. Spin a bow drill to coax a coal, ring it in fieldstone, and feed it sticks — heat unlocks calories the raw food keeps to itself.",
    kind: "utility",
    benefit: "Unlocks roasting roots, tubers, and greens — meaningfully more food per harvest.",
    requires: ["campfire"],
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
    done: (ctx) => ctx.has("bread"),
  },
  {
    id: "oil_press",
    title: "Press the first oil",
    description:
      "A bronze-bound screw and a stone bed. Plant sunflowers in summer, press the heads in autumn — oil for the dark and seedcake for the table.",
    kind: "progression",
    benefit: "Unlocks sunflower oil and seedcake — the first products that aren't pulled from the ground or off a tree.",
    requires: ["oil_press"],
    prereq: ["clay_kiln"],
    done: (ctx) => ctx.has("oil_press"),
  },
  {
    id: "clay_jar",
    title: "Throw a clay jar",
    description:
      "A shelf is honest about what it can do for food. A lidded earthen jar, fired in the kiln, isn't — cool and dark and dry, it stretches the keeping of anything you put inside.",
    kind: "utility",
    benefit: "Unlocks the clay jar — a small storage chest that doubles the shelf life of perishables stored inside.",
    requires: ["clay_jar"],
    prereq: ["clay_kiln"],
    done: (ctx) => ctx.has("clay_jar"),
  },
  {
    id: "sealed_jar",
    title: "Pitch a jar shut",
    description:
      "A jar with a loose lid still breathes. Melt resin around the rim at the campfire and the seam closes — what's inside keeps for a season or more.",
    kind: "utility",
    benefit: "Unlocks the pitched jar — larger and quadruples shelf life. Long-haul preservation for the autumn stockpile.",
    requires: ["sealed_jar"],
    prereq: ["clay_jar"],
    done: (ctx) => ctx.has("sealed_jar"),
  },
  {
    id: "strong_cordage",
    title: "Twist a length of strong cordage",
    description:
      "Wild plant fiber parts under load. Plant flax in spring, sink the stalks in a retting pit, spin the freed fibers to thread, and ply the thread into a rope worth lashing a haul to.",
    kind: "progression",
    benefit: "Stronger cordage — substitutes anywhere plain cordage is called for, and a meaningfully better return per cycle than wild fiber.",
    requires: ["strong_cordage"],
    prereq: ["tilled_plot"],
    done: (ctx) => ctx.has("strong_cordage"),
  },
];

export const QUESTS: Record<QuestId, Quest> = Object.fromEntries(
  ALL_QUESTS.map((q) => [q.id, q]),
);
