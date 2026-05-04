import type { Item, ItemId } from "./types";

const list: Item[] = [
  // raw / woodland
  { id: "log", name: "Log", icon: "🪵", description: "A rough length of split wood from a felled tree." },
  { id: "plant_fiber", name: "Plant Fiber", icon: "🌿", description: "Tough strands of grass and bark. Twists into cordage." },
  { id: "resin", name: "Resin", icon: "💧", description: "Sticky tree sap. Useful, eventually." },

  // soil
  { id: "loam", name: "Loam", icon: "🟤", description: "Dark crumbly soil. Binds clay into daub." },
  { id: "clay_lump", name: "Clay Lump", icon: "🟫", description: "Wet, plastic clay. Fires into bricks." },
  { id: "wheat_seed", name: "Wheat Seed", icon: "🌾", description: "Could grow something, eventually." },
  { id: "sunflower_seed", name: "Sunflower Seed", icon: "🌻", description: "Bright. Pressable. Probably." },

  // quarry
  { id: "rubble", name: "Rubble", icon: "🪨", description: "Loose chips and broken rock. The bones of cob walls." },
  { id: "fieldstone", name: "Fieldstone", icon: "🗿", description: "Solid hand-sized blocks. Stacks into hearths and kilns." },
  { id: "flint", name: "Flint", icon: "⬛", description: "Glassy stone that flakes to a sharp edge. Knap it into a blade." },
  { id: "coal", name: "Coal", icon: "⚫", description: "Burns hotter than charcoal. Found deeper in the rock." },
  { id: "copper_ore", name: "Copper Ore", icon: "🟠", description: "Greenish veined rock. The first metal humans worked." },
  { id: "tin_ore", name: "Tin Ore", icon: "⚪", description: "Heavy black stone with a bright streak. The other half of bronze." },
  { id: "iron_ore", name: "Iron Ore", icon: "🟥", description: "Dense, rusty. Needs a hotter fire than a kiln can manage." },

  // intermediates
  { id: "board", name: "Board", icon: "🟫", description: "Hand-split from a log. Construction stock." },
  { id: "haft", name: "Haft", icon: "➖", description: "A shaped wooden handle. Lashed to tool heads." },
  { id: "cordage", name: "Cordage", icon: "🪢", description: "Twisted plant fiber. Lashes hafts to heads, holds crates together." },
  { id: "charcoal", name: "Charcoal", icon: "🌑", description: "Wood baked anaerobic. Burns clean and hot enough for copper and bronze." },
  { id: "daub", name: "Daub", icon: "🟫", description: "Clay, fiber and loam mashed together. Sets hard when fired." },
  { id: "clay_brick", name: "Clay Brick", icon: "🧱", description: "Kiln-fired refractory brick. Holds heat for the bloomery." },
  { id: "crucible", name: "Crucible", icon: "🍶", description: "A fired clay vessel for alloying. Cracks after one pour." },

  // metal ingots
  { id: "copper_ingot", name: "Copper Ingot", icon: "🟧", description: "Smelted copper. Soft enough to cold-hammer." },
  { id: "tin_ingot", name: "Tin Ingot", icon: "◽", description: "Smelted tin. Useless alone, transformative in alloy." },
  { id: "bronze_ingot", name: "Bronze Ingot", icon: "🟡", description: "Copper and tin married in a crucible. The first real metal." },
  { id: "iron_ingot", name: "Iron Ingot", icon: "⚙️", description: "Hammered out of a bloom. Hard, stubborn, worth it." },

  // tools (tier 1 = flint, 2 = copper, 3 = bronze, 4 = iron)
  { id: "flint_hatchet", name: "Flint Hatchet", icon: "🪓", description: "A knapped flint head lashed to a haft. Cuts wood, just barely.", tool: { type: "axe", tier: 1 } },
  { id: "flint_pick", name: "Flint Pick", icon: "⛏️", description: "Sharp enough to pry copper and tin out of softer rock.", tool: { type: "pickaxe", tier: 1 } },
  { id: "flint_shovel", name: "Flint Shovel", icon: "🥄", description: "A flake of flint on a haft. Better than digging with hands.", tool: { type: "shovel", tier: 1 } },
  { id: "copper_axe", name: "Copper Axe", icon: "🪓", description: "Cold-hammered copper. Bites cleaner than flint.", tool: { type: "axe", tier: 2 } },
  { id: "copper_pick", name: "Copper Pick", icon: "⛏️", description: "Strong enough for iron ore and the deeper coal seams.", tool: { type: "pickaxe", tier: 2 } },
  { id: "copper_shovel", name: "Copper Shovel", icon: "🥄", description: "Turns soil faster and finds more clay.", tool: { type: "shovel", tier: 2 } },
  { id: "bronze_axe", name: "Bronze Axe", icon: "🪓", description: "A real axe.", tool: { type: "axe", tier: 3 } },
  { id: "bronze_pick", name: "Bronze Pick", icon: "⛏️", description: "Reveals richer copper and tin veins.", tool: { type: "pickaxe", tier: 3 } },
  { id: "iron_axe", name: "Iron Axe", icon: "🪓", description: "Heavy. Splits a log in two strokes.", tool: { type: "axe", tier: 4 } },
  { id: "iron_pick", name: "Iron Pick", icon: "⛏️", description: "Pulls deeper iron from the rock and exposes ores a bronze pick can't reach.", tool: { type: "pickaxe", tier: 4 } },

  // workshop blocks (also act as machine "slots" via inventory count)
  { id: "workbench", name: "Workbench", icon: "🧰", description: "A bench for non-trivial hand assembly." },
  { id: "crate", name: "Crate", icon: "📦", description: "Generic storage. Probably full of loam soon." },
  { id: "bound_crate", name: "Bronze-Bound Crate", icon: "🗃️", description: "Looks important. Probably is." },
  { id: "charcoal_pit", name: "Charcoal Pit", icon: "🔥", description: "A turf-covered pit that smolders logs into charcoal." },
  { id: "clay_kiln", name: "Clay Kiln", icon: "🏺", description: "A cob-and-stone kiln. Fires bricks, smelts copper and tin, alloys bronze." },
  { id: "bloomery", name: "Bloomery", icon: "🏭", description: "A refractory stack hot enough to coax iron out of ore." },
];

export const ITEMS: Record<ItemId, Item> = Object.fromEntries(list.map((i) => [i.id, i]));
export const ALL_ITEMS: Item[] = list;

export function item(id: ItemId): Item {
  const it = ITEMS[id];
  if (!it) throw new Error(`Unknown item: ${id}`);
  return it;
}
