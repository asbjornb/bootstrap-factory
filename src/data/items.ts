import type { Item, ItemId } from "./types";

const list: Item[] = [
  // raw / nature
  { id: "wood", name: "Wood", icon: "🪵", description: "Rough logs from a felled tree." },
  { id: "apple", name: "Apple", icon: "🍎", description: "Edible. Occasionally falls from a tree." },
  { id: "dirt", name: "Dirt", icon: "🟫", description: "Soft earth. Useful for terrain and a handful of recipes." },
  { id: "wheat_seed", name: "Wheat Seed", icon: "🌾", description: "Could grow something, eventually." },
  { id: "sunflower_seed", name: "Sunflower Seed", icon: "🌻", description: "Bright. Pressable. Probably." },

  // stone tier
  { id: "stone", name: "Stone", icon: "🪨", description: "The bones of the workshop." },
  { id: "coal_ore", name: "Coal Ore", icon: "⬛", description: "Smelts down into coal." },
  { id: "coal", name: "Coal", icon: "🪨", description: "Burns. Powers furnaces." },

  // metal ores
  { id: "tin_ore", name: "Tin Ore", icon: "⬜", description: "Soft, shiny, requires at least a wooden pickaxe to gather." },
  { id: "copper_ore", name: "Copper Ore", icon: "🟧", description: "Reddish. Half of bronze." },
  { id: "iron_ore", name: "Iron Ore", icon: "🟥", description: "Dense. Needs a stone pickaxe or better." },

  // metal ingots
  { id: "tin_ingot", name: "Tin Ingot", icon: "⚪", description: "Smelted tin." },
  { id: "copper_ingot", name: "Copper Ingot", icon: "🟠", description: "Smelted copper." },
  { id: "iron_ingot", name: "Iron Ingot", icon: "⚙️", description: "Smelted iron." },
  { id: "bronze_ingot", name: "Bronze Ingot", icon: "🟡", description: "Copper + tin, alloyed in a furnace." },

  // intermediate
  { id: "planks", name: "Planks", icon: "🟫", description: "Sawn from wood. Building block of nearly everything." },
  { id: "stick", name: "Stick", icon: "➖", description: "Tool handles, fences, torches." },
  { id: "torch", name: "Torch", icon: "🔥", description: "Light. Probably useful in caves." },

  // tools
  { id: "wooden_axe", name: "Wooden Axe", icon: "🪓", description: "Required to chop boards into chests.", tool: { type: "axe", tier: 1 } },
  { id: "wooden_pickaxe", name: "Wooden Pickaxe", icon: "⛏️", description: "Pries loose tin and copper.", tool: { type: "pickaxe", tier: 1 } },
  { id: "wooden_shovel", name: "Wooden Shovel", icon: "🥄", description: "For laying out new rooms.", tool: { type: "shovel", tier: 1 } },
  { id: "stone_pickaxe", name: "Stone Pickaxe", icon: "⛏️", description: "Strong enough for iron ore.", tool: { type: "pickaxe", tier: 2 } },
  { id: "stone_axe", name: "Stone Axe", icon: "🪓", description: "Better wood yields.", tool: { type: "axe", tier: 2 } },
  { id: "bronze_pickaxe", name: "Bronze Pickaxe", icon: "⛏️", description: "Reveals richer ore deposits.", tool: { type: "pickaxe", tier: 3 } },
  { id: "bronze_axe", name: "Bronze Axe", icon: "🪓", description: "A real axe.", tool: { type: "axe", tier: 3 } },
  { id: "iron_pickaxe", name: "Iron Pickaxe", icon: "⛏️", description: "Unlocks ores a bronze pick can't.", tool: { type: "pickaxe", tier: 4 } },

  // workshop blocks
  { id: "crafting_table", name: "Crafting Table", icon: "🧰", description: "Hand-crafting station for non-trivial recipes." },
  { id: "chest", name: "Wooden Chest", icon: "🟫", description: "Generic storage. Probably full of dirt soon." },
  { id: "furnace", name: "Furnace", icon: "🔥", description: "Smelts ores and bakes intermediates." },
  { id: "bronze_chest", name: "Bronze-Bound Chest", icon: "🟧", description: "Looks important. Probably is." },
];

export const ITEMS: Record<ItemId, Item> = Object.fromEntries(list.map((i) => [i.id, i]));
export const ALL_ITEMS: Item[] = list;

export function item(id: ItemId): Item {
  const it = ITEMS[id];
  if (!it) throw new Error(`Unknown item: ${id}`);
  return it;
}
