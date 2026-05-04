import type { Quest, QuestId } from "./types";

export const ALL_QUESTS: Quest[] = [
  {
    id: "flint_shovel",
    title: "Knap a flint shovel",
    description:
      "Hands turn soil slowly and the clay sits out of reach. A flake of flint lashed to a haft would change that — knap one at the workbench.",
    visible: () => true,
    done: (ctx) => ctx.has("flint_shovel"),
  },
];

export const QUESTS: Record<QuestId, Quest> = Object.fromEntries(
  ALL_QUESTS.map((q) => [q.id, q]),
);
