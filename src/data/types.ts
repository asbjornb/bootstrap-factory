export type ItemId = string;
export type RecipeId = string;
export type MachineId = string;
export type GatherId = string;
export type BiomeId = string;
export type NodeId = string;

export type ToolType = "axe" | "pickaxe" | "shovel";

export interface ToolRequirement {
  type: ToolType;
  minTier: number;
}

export interface Item {
  id: ItemId;
  name: string;
  icon: string;
  description?: string;
  /** If set, this item can be used as a tool of the given type. */
  tool?: { type: ToolType; tier: number };
  /** Max units in one inventory slot. Default 64. Tools/machines/chests use 1. */
  stackSize?: number;
  /** Owning this item adds to the player's carry capacity. Highest single bonus applies (does not stack). */
  carryBonus?: number;
}

export interface Stack {
  item: ItemId;
  qty: number;
}

export interface Recipe {
  id: RecipeId;
  machine: MachineId;
  inputs: Stack[];
  outputs: Stack[];
  /** Tool that must be held (not consumed) to perform the recipe. */
  tool?: ToolRequirement;
  /** How long the machine is busy producing this recipe. 0/undefined = instant. */
  durationMs?: number;
}

export interface Machine {
  id: MachineId;
  name: string;
  icon: string;
  description?: string;
}

export interface DropEntry {
  item: ItemId;
  /** Inclusive range. */
  qty: [number, number];
  /** 0..1 probability. */
  chance: number;
  /** If set, the player must hold a tool of this type at >= minTier for this drop to roll. */
  requiresTool?: ToolRequirement;
  /** If set, the drop only rolls once the player has ever crafted this machine. */
  requiresMachineEverBuilt?: MachineId;
}

export interface Chest {
  id: string;
  /** Item id of the chest type (e.g. "chest", "bronze_chest"). */
  type: ItemId;
  /** Stored contents. */
  contents: Record<ItemId, number>;
}

export interface Room {
  id: string;
  name: string;
  /** Count of each machine placed in this room. */
  machines: Record<MachineId, number>;
  /** Storage chests placed in this room. */
  chests: Chest[];
}

export interface GatherSpeedup {
  type: ToolType;
  /** Minimum tier of the matching tool. The best matching speedup wins. */
  minTier: number;
  durationMs: number;
}

export interface GatherAction {
  id: GatherId;
  name: string;
  icon: string;
  description?: string;
  drops: DropEntry[];
  /** Time to complete with no qualifying tools. */
  baseDurationMs: number;
  /** Tool tiers that shorten the action. Lowest matching duration wins. */
  speedups?: GatherSpeedup[];
}

/** A finite resource node found by exploring a biome. Charges deplete with each harvest. */
export interface ResourceNode {
  id: NodeId;
  name: string;
  icon: string;
  biome: BiomeId;
  description?: string;
  /** Tool gating the harvest action itself (not just specific drops). */
  requiresTool?: ToolRequirement;
  baseDurationMs: number;
  speedups?: GatherSpeedup[];
  drops: DropEntry[];
}

/** One possible exploration result. The biome rolls a weighted pick from these. */
export interface BiomeOutcome {
  weight: number;
  message: string;
  /** Charges added to nodes when this outcome fires. */
  charges: { node: NodeId; qty: [number, number] }[];
}

export interface Biome {
  id: BiomeId;
  name: string;
  icon: string;
  description?: string;
  exploreDurationMs: number;
  outcomes: BiomeOutcome[];
}

export type QuestId = string;

export type QuestKind = "progression" | "utility";

export interface QuestContext {
  has: (item: ItemId, qty?: number) => boolean;
  completed: (questId: QuestId) => boolean;
}

export interface Quest {
  id: QuestId;
  title: string;
  description: string;
  /** Progression quests open new tiers; utility quests just make life easier. */
  kind: QuestKind;
  /** Short note on what completing this quest gets the player. */
  benefit: string;
  /** Items the player needs to obtain or build to complete the quest. Shown as chips that open the recipe index. */
  requires?: ItemId[];
  /** Quest is shown (as active) when this returns true and it isn't completed yet. */
  visible: (ctx: QuestContext) => boolean;
  /** Quest is checked off when this returns true. */
  done: (ctx: QuestContext) => boolean;
}
