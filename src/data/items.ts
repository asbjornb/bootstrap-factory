import type { Item, ItemId } from "./types";

const list: Item[] = [
  // raw / woodland
  { id: "log", name: "Log", icon: "🪵", description: "A rough length of split wood from a felled tree." },
  { id: "stick", name: "Stick", icon: "🥢", description: "A handful of dry sticks pulled from the brush. Whittles into rough hafts." },
  { id: "plant_fiber", name: "Plant Fiber", icon: "🌿", description: "Tough strands of grass and bark. Twists into cordage." },
  { id: "resin", name: "Resin", icon: "💧", description: "Sticky tree sap. Useful, eventually." },

  // forage food (perishable). Berries are tagged so any berry can dry.
  { id: "bramble_berries", name: "Bramble Berries", icon: "🫐", description: "A handful of summer brambles. Sweet and bursting — eat soon, they don't keep.", food: { satiatesMinutes: 30 }, spoilsAfter: 12 * 60, tags: ["berry"] },
  { id: "elderberries", name: "Elderberries", icon: "🍇", description: "Dark autumn clusters. A little tart, a little astringent, but they hold a few days longer than the summer fruit.", food: { satiatesMinutes: 30 }, spoilsAfter: 16 * 60, tags: ["berry"] },
  { id: "spring_shoots", name: "Spring Shoots", icon: "🌱", description: "Tender new greens pushed up after the thaw. Bitter but filling, and the first real food of the year.", food: { satiatesMinutes: 20 }, spoilsAfter: 8 * 60 },
  { id: "edible_root", name: "Edible Root", icon: "🥕", description: "A stubby tuber pulled from the soil. Earthy. Filling.", food: { satiatesMinutes: 60 }, spoilsAfter: 32 * 60 },
  { id: "pine_bark", name: "Pine Bark", icon: "🪵", description: "Strips of inner bark, peeled in winter when nothing else stirs. Tough and resinous, but it keeps a body going.", food: { satiatesMinutes: 20 } },
  { id: "frozen_tuber", name: "Frozen Tuber", icon: "🥶", description: "A root pried from frozen ground. Hard as wood until you thaw it, but full of stored sugars.", food: { satiatesMinutes: 50 } },

  // preserved food (long shelf life, modest nutrition loss vs. fresh). Tagged
  // "ration" so any of them can be packed for an expedition.
  { id: "dried_berries", name: "Dried Berries", icon: "🍇", description: "Sun-and-rack dried. Keeps for a season — preserves the food, with a small loss of nourishment from the drying.", food: { satiatesMinutes: 80 }, stackSize: 32, tags: ["ration"] },
  { id: "dried_root", name: "Dried Root", icon: "🍠", description: "Sliced thin and racked in sun and wind until leathery. Road-ready and shelf-stable, with a small loss of nourishment from the drying.", food: { satiatesMinutes: 100 }, stackSize: 32, tags: ["ration"] },

  // cooked food (campfire). Heat breaks down starches and lignin, freeing
  // calories the raw form locked away. Spoils slower than raw but isn't
  // shelf-stable — drying is still the preservation track.
  { id: "roast_root", name: "Roast Root", icon: "🍠", description: "A root buried in coals until the skin blackens and the heart goes sweet. Heat unlocks calories the raw tuber kept to itself.", food: { satiatesMinutes: 80 }, spoilsAfter: 64 * 60 },
  { id: "roast_tuber", name: "Roast Tuber", icon: "🥔", description: "A frozen tuber thawed and roasted on the embers. The cold-stored sugars caramelise; what was a chore to chew turns into a meal.", food: { satiatesMinutes: 70 } },
  { id: "wilted_greens", name: "Wilted Greens", icon: "🥬", description: "Spring shoots passed through the smoke until limp. Heat tames the bitterness and breaks the cell walls; a handful goes further than it has any right to.", food: { satiatesMinutes: 28 }, spoilsAfter: 16 * 60 },

  // hunting — raw and prepared meat. Raw meat is a poor eat on its own; the
  // payoff is in cooking, where heat unlocks the calories the gut can't reach
  // raw. Jerky is the travel form — most of the food value of cooked, kept.
  { id: "raw_meat", name: "Raw Meat", icon: "🥩", description: "A bloody slab off the day's kill. Filling raw, but the gut barely cracks it — heat is what makes a meal of it.", food: { satiatesMinutes: 40 }, spoilsAfter: 10 * 60, stackSize: 16 },
  { id: "cooked_meat", name: "Cooked Meat", icon: "🍖", description: "Charred outside, hot through. Heat breaks the muscle and frees calories the raw cut hoarded — a kill goes a long way once it's been on the embers.", food: { satiatesMinutes: 140 }, spoilsAfter: 48 * 60, stackSize: 16 },
  { id: "jerky", name: "Jerky", icon: "🥓", description: "Strips dried hard on the rack. Most of the meat's calories, none of its weight or rot — the ration that travels furthest.", food: { satiatesMinutes: 110 }, stackSize: 32, tags: ["ration"] },
  { id: "hide", name: "Hide", icon: "🟫", description: "A green hide pulled off the carcass. Stiff and unfinished — leather is a job for later, but you stash it for the day you can work it.", stackSize: 16 },

  // soil
  { id: "loam", name: "Loam", icon: "🟤", description: "Dark crumbly soil. Binds clay into daub." },
  { id: "clay_lump", name: "Clay Lump", icon: "🟫", description: "Wet, plastic clay. Fires into bricks." },
  { id: "wheat_seed", name: "Wheat Seed", icon: "🌾", description: "Plant in spring. With luck the soil gives back more than it took.", stackSize: 32 },
  { id: "sunflower_seed", name: "Sunflower Seed", icon: "🌻", description: "Bright. Pressable. Probably.", stackSize: 32 },

  // agriculture — wheat chain
  { id: "wheat_grain", name: "Wheat Grain", icon: "🌾", description: "Threshed wheat. Gritty raw — milled to flour, baked to bread.", stackSize: 32 },
  { id: "flour", name: "Flour", icon: "🥣", description: "Stone-milled wheat. Lasts the winter on a shelf, but only becomes food once it meets a fire.", stackSize: 32 },
  { id: "bread", name: "Bread", icon: "🍞", description: "Flour and a fire and a little patience. The first food worth carrying that the season can't take from you.", food: { satiatesMinutes: 110 }, spoilsAfter: 32 * 60, stackSize: 16, tags: ["ration"] },

  // agriculture — sunflower chain
  { id: "sunflower_head", name: "Sunflower Head", icon: "🌻", description: "A heavy disc dense with seeds. Press for oil; what's left over feeds you another day.", stackSize: 16 },
  { id: "sunflower_oil", name: "Sunflower Oil", icon: "🫙", description: "Pale gold and slow to pour. The first ingredient that doesn't come out of the ground or off a tree.", stackSize: 16 },
  { id: "seedcake", name: "Seedcake", icon: "🟫", description: "Sunflower pulp left behind in the press. Mealy, oily, filling.", food: { satiatesMinutes: 60 }, stackSize: 32, tags: ["ration"] },

  // agriculture — flax chain
  { id: "flax_seed", name: "Flax Seed", icon: "🌱", description: "Plant in spring. The stalks are the prize — straight fibers that twist into stronger cordage than wild brush.", stackSize: 32 },
  { id: "flax_stalks", name: "Flax Stalks", icon: "🌾", description: "Bundled stems pulled at harvest. Useless until the retting pit softens the bast away from the woody core.", stackSize: 32 },
  { id: "retted_flax", name: "Retted Flax", icon: "🪶", description: "Long pale fibers, water-rotted free of their stems. Spins clean to thread.", stackSize: 32 },
  { id: "linen_thread", name: "Linen Thread", icon: "🧵", description: "Tight-spun flax. Thin enough to weave, strong enough to twist.", stackSize: 32 },
  { id: "strong_cordage", name: "Strong Cordage", icon: "🪢", description: "Plied linen rope. Holds where plant-fiber twist parts, and one length goes where two of the rough kind used to.", tags: ["cordage"] },

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
  { id: "cordage", name: "Cordage", icon: "🪢", description: "Twisted plant fiber. Lashes hafts to heads, holds crates together.", tags: ["cordage"] },
  { id: "bow_drill", name: "Bow Drill", icon: "🏹", description: "A bowed cord, a spindle, a hearth board. Spin it long enough and a coal blooms from nothing. Good for one fire.", stackSize: 1 },
  { id: "charcoal", name: "Charcoal", icon: "🌑", description: "Wood baked anaerobic. Burns clean and hot enough for copper and bronze." },
  { id: "daub", name: "Daub", icon: "🟫", description: "Clay, fiber and loam mashed together. Sets hard when fired." },
  { id: "clay_brick", name: "Clay Brick", icon: "🧱", description: "Kiln-fired refractory brick. Holds heat for the bloomery." },
  { id: "crucible", name: "Crucible", icon: "🍶", description: "A fired clay vessel for alloying. Cracks after one pour." },

  // metal ingots
  { id: "copper_ingot", name: "Copper Ingot", icon: "🟧", description: "Smelted copper. Soft enough to cold-hammer.", stackSize: 32 },
  { id: "tin_ingot", name: "Tin Ingot", icon: "◽", description: "Smelted tin. Useless alone, transformative in alloy.", stackSize: 32 },
  { id: "bronze_ingot", name: "Bronze Ingot", icon: "🟡", description: "Copper and tin married in a crucible. The first real metal.", stackSize: 32 },
  { id: "iron_ingot", name: "Iron Ingot", icon: "⚙️", description: "Hammered out of a bloom. Hard, stubborn, worth it.", stackSize: 32 },

  // tools (tier 1 = flint, 2 = copper, 3 = bronze, 4 = iron)
  { id: "flint_hatchet", name: "Flint Hatchet", icon: "🪓", description: "A knapped flint head lashed to a haft. Cuts wood, just barely.", tool: { type: "axe", tier: 1 }, stackSize: 1 },
  { id: "flint_pick", name: "Flint Pick", icon: "⛏️", description: "A knapped point lashed to a haft. Works rock without ruining your knuckles.", tool: { type: "pickaxe", tier: 1 }, stackSize: 1 },
  { id: "flint_shovel", name: "Flint Shovel", icon: "🥄", description: "A flake of flint on a haft. Better than digging with hands.", tool: { type: "shovel", tier: 1 }, stackSize: 1 },
  { id: "copper_axe", name: "Copper Axe", icon: "🪓", description: "Cold-hammered copper. Bites cleaner than flint.", tool: { type: "axe", tier: 2 }, stackSize: 1 },
  { id: "copper_pick", name: "Copper Pick", icon: "⛏️", description: "Bites rock noticeably faster than flint.", tool: { type: "pickaxe", tier: 2 }, stackSize: 1 },
  { id: "copper_shovel", name: "Copper Shovel", icon: "🥄", description: "Turns soil faster and finds more clay.", tool: { type: "shovel", tier: 2 }, stackSize: 1 },
  { id: "bronze_axe", name: "Bronze Axe", icon: "🪓", description: "A real axe.", tool: { type: "axe", tier: 3 }, stackSize: 1 },
  { id: "bronze_pick", name: "Bronze Pick", icon: "⛏️", description: "Heavier swing, bigger chips. Pulls richer copper and tin from the same outcrop.", tool: { type: "pickaxe", tier: 3 }, stackSize: 1 },
  { id: "iron_axe", name: "Iron Axe", icon: "🪓", description: "Heavy. Splits a log in two strokes.", tool: { type: "axe", tier: 4 }, stackSize: 1 },
  { id: "iron_pick", name: "Iron Pick", icon: "⛏️", description: "Cleaves stone in fewer strokes and turns up more iron and coal per swing.", tool: { type: "pickaxe", tier: 4 }, stackSize: 1 },
  { id: "flint_spear", name: "Flint Spear", icon: "🔱", description: "A long shaft, a knapped point, and a length of cordage holding them together. Hold it to stalk game in the brush.", tool: { type: "spear", tier: 1 }, stackSize: 1 },

  // carry gear — owning the item buffs your inventory cap (bonuses stack across worn items)
  { id: "belt_pouch", name: "Belt Pouch", icon: "🎒", description: "A simple belt with loops and pouches. Carry a little more.", stackSize: 1, carryBonus: 2, oneTime: true },
  { id: "haul_pack", name: "Haul Pack", icon: "🎒", description: "Boards and cordage shaped into a proper pack. Hauls a respectable load — pairs well with a belt pouch.", stackSize: 1, carryBonus: 6, oneTime: true },

  // workshop blocks (also act as machine "slots" via inventory count)
  { id: "workbench", name: "Workbench", icon: "🧰", description: "A bench for non-trivial hand assembly.", stackSize: 1 },
  { id: "crate", name: "Crate", icon: "📦", description: "Generic storage. Probably full of loam soon.", stackSize: 1 },
  { id: "bound_crate", name: "Bronze-Bound Crate", icon: "🗃️", description: "Looks important. Probably is.", stackSize: 1 },
  { id: "clay_jar", name: "Clay Jar", icon: "🏺", description: "A fired earthen jar with a heavy lid. Cool, dark, and dry — food kept inside lasts noticeably longer than on a shelf.", stackSize: 1 },
  { id: "sealed_jar", name: "Pitched Jar", icon: "🫙", description: "A clay jar with a rim of melted resin sealing the lid. Air barely gets in; what's stored inside keeps for a season or more.", stackSize: 1 },
  { id: "campfire", name: "Campfire", icon: "🔥", description: "A ring of fieldstone around a banked ember. The first cooking surface — burns sticks, roasts roots and greens.", stackSize: 1 },
  { id: "charcoal_pit", name: "Charcoal Pit", icon: "🔥", description: "A turf-covered pit that smolders logs into charcoal.", stackSize: 1 },
  { id: "clay_kiln", name: "Clay Kiln", icon: "🏺", description: "A cob-and-stone kiln. Fires bricks, smelts copper and tin, alloys bronze.", stackSize: 1 },
  { id: "bloomery", name: "Bloomery", icon: "🏭", description: "A refractory stack hot enough to coax iron out of ore.", stackSize: 1 },
  { id: "drying_rack", name: "Drying Rack", icon: "🪵", description: "Frame and lashings strung in the sun and breeze. Turns berries and roots into food that keeps.", stackSize: 1 },
  { id: "tilled_plot", name: "Tilled Plot", icon: "🟫", description: "A bed of turned soil staked out for one planting. Crops grow in season; sleep through the wait and come back to a harvest.", stackSize: 1 },
  { id: "oil_press", name: "Oil Press", icon: "🫒", description: "A bronze-bound screw and a stone bed. Crushes sunflower heads until the oil weeps clear.", stackSize: 1 },
  { id: "retting_pit", name: "Retting Pit", icon: "🪣", description: "A clay-lined hollow held shallow with water. Soaks flax stalks until rot lets go of the fiber.", stackSize: 1 },
];

export const ITEMS: Record<ItemId, Item> = Object.fromEntries(list.map((i) => [i.id, i]));
export const ALL_ITEMS: Item[] = list;
export const ALL_TAGS: string[] = Array.from(
  new Set(list.flatMap((i) => i.tags ?? [])),
).sort();

export function item(id: ItemId): Item {
  const it = ITEMS[id];
  if (!it) throw new Error(`Unknown item: ${id}`);
  return it;
}

export function stackSize(id: ItemId): number {
  return ITEMS[id]?.stackSize ?? 64;
}

/** All items that carry the given tag. */
export function itemsWithTag(tag: string): Item[] {
  return list.filter((i) => i.tags?.includes(tag));
}

export function hasTag(id: ItemId, tag: string): boolean {
  return ITEMS[id]?.tags?.includes(tag) ?? false;
}
