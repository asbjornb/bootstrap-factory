export type ItemId = string;
export type RecipeId = string;
export type MachineId = string;
export type GatherId = string;

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
}

export interface GatherAction {
  id: GatherId;
  name: string;
  icon: string;
  description?: string;
  drops: DropEntry[];
}
