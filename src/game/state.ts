import { BIOMES } from "../data/biomes";
import { GATHER_ACTIONS } from "../data/gather";
import { ITEMS, itemsWithTag, stackSize } from "../data/items";
import { MACHINES } from "../data/machines";
import { NODES } from "../data/nodes";
import { ALL_QUESTS } from "../data/quests";
import { RECIPES } from "../data/recipes";
import { WANDER_ACTIVE_TIME, WANDER_DURATION_MS, WANDER_OUTCOMES, type WanderOutcome } from "../data/wander";
import { DURATION_SCALE } from "./dev";
import { migrate } from "./migrations";
import { realMsToGameMinutes } from "./time";
import { isTagInput } from "../data/types";
import type {
  Biome,
  BiomeId,
  DropEntry,
  GatherAction,
  GatherId,
  GatherSpeedup,
  Item,
  ItemId,
  MachineId,
  NodeId,
  PerishableBatch,
  PlacedChest,
  PlacedMachine,
  QuestId,
  Recipe,
  RecipeId,
  RecipeInput,
  ResourceNode,
  Room,
  Stack,
  ToolRequirement,
} from "../data/types";

export type { PerishableBatch } from "../data/types";

export interface MachineJob {
  id: string;
  machineId: MachineId;
  /** Which placed instance is busy; null for hand recipes. */
  instanceId: string | null;
  recipeId: RecipeId;
  startedAt: number;
  endsAt: number;
}

export type ActionJob =
  | { kind: "gather"; gatherId: GatherId; startedAt: number; endsAt: number }
  | { kind: "harvest"; nodeId: NodeId; startedAt: number; endsAt: number }
  | { kind: "explore"; biomeId: BiomeId; startedAt: number; endsAt: number }
  | { kind: "wander"; startedAt: number; endsAt: number };

export interface GameState {
  schemaVersion: number;
  inventory: Record<ItemId, number>;
  /** Items that overflowed when the player's inventory was full. Workshop floor pile. */
  floor: Record<ItemId, number>;
  jobs: MachineJob[];
  /** The single foreground gather/harvest/explore action in progress, if any. */
  actionJob: ActionJob | null;
  /** Charges remaining on each discovered resource node. Hidden when 0. */
  nodeCharges: Record<NodeId, number>;
  /** Biomes the player has discovered (and can therefore explore). */
  discoveredBiomes: Record<BiomeId, boolean>;
  /** Last exploration outcome message — surfaced in the UI for one explore. */
  lastExploreMessage: string | null;
  rooms: Room[];
  /** Machines the player has ever finished crafting. Gates "you know what this rock is for". */
  everBuilt: Record<MachineId, boolean>;
  completedQuests: QuestId[];
  pinnedRecipes: RecipeId[];
  /** Length of an in-world day, in minutes. */
  dayLength: number;
  /** Player's remaining "minutes of work" today. Capped at dayLength. Refilled by eating. */
  timeBudget: number;
  /** Minutes elapsed since the start of the current day. 0..dayLength. */
  worldClock: number;
  /** Day count, starting at 1. Bumps on Sleep. */
  dayNumber: number;
  /**
   * Per perishable item id: a FIFO list of batches with their own expiry,
   * sorted oldest-first. The total qty across an id's batches always equals
   * `inventory[id] + floor[id]`. Empty arrays are pruned.
   */
  perishables: Record<ItemId, PerishableBatch[]>;
  /** Index 0..3 for spring/summer/autumn/winter. Advances every `daysPerSeason` sleeps. */
  seasonIndex: number;
}

const SCHEMA_VERSION = 18;

/** Number of in-world days per season. 4 seasons make a year. */
export const DAYS_PER_SEASON = 8;
export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;
export type Season = (typeof SEASONS)[number];

/** Default in-world day length, in minutes. 16 active hours. */
export const DEFAULT_DAY_LENGTH = 16 * 60;
/** Starting time-budget on a fresh save. ~6 hours of work. */
export const DEFAULT_STARTING_BUDGET = 6 * 60;
/** Always-allowed fallback action: never blocked by an empty time budget. */
export const FLOOR_GATHER_ID: GatherId = "forage_nearby";

/** Slots in the player's bare-hands inventory before any carry-gear bonus. */
export const BASE_CARRY_SLOTS = 8;

/** Slot capacity per chest type. */
export const CHEST_SLOT_CAP: Record<ItemId, number> = {
  crate: 16,
  bound_crate: 32,
  clay_jar: 8,
  sealed_jar: 12,
};

/**
 * Spoilage multiplier applied to perishables stored in this chest type.
 * A factor of 2 means a stack with 30 minutes of remaining shelf life
 * will keep for 60 minutes inside; on withdrawal the remaining shelf
 * life is scaled back down so the round-trip is neutral.
 */
export const CHEST_PRESERVE_FACTOR: Record<ItemId, number> = {
  clay_jar: 2,
  sealed_jar: 4,
};

export function chestPreserveFactor(type: ItemId): number {
  return CHEST_PRESERVE_FACTOR[type] ?? 1;
}

export const ROOM_BUILD_COST: Stack[] = [{ item: "board", qty: 25 }];
export const ROOM_BUILD_TOOL: ToolRequirement = { type: "shovel", minTier: 1 };

export function emptyState(): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    inventory: {},
    floor: {},
    jobs: [],
    actionJob: null,
    nodeCharges: {},
    discoveredBiomes: { forest: true },
    lastExploreMessage: null,
    rooms: [{ id: "room-starter", name: "Workshop", cells: [] }],
    everBuilt: {},
    completedQuests: [],
    pinnedRecipes: [],
    dayLength: DEFAULT_DAY_LENGTH,
    timeBudget: DEFAULT_STARTING_BUDGET,
    worldClock: 0,
    dayNumber: 1,
    perishables: {},
    seasonIndex: 0,
  };
}

/** Cumulative in-world minutes since the dawn of day 1. Used for spoilage timers. */
export function gameMinutes(state: GameState): number {
  return (state.dayNumber - 1) * state.dayLength + state.worldClock;
}

export function currentSeason(state: GameState): Season {
  return SEASONS[state.seasonIndex % SEASONS.length]!;
}

type Listener = (s: GameState) => void;

class Store {
  private state: GameState = emptyState();
  private listeners: Set<Listener> = new Set();

  get(): GameState {
    return this.state;
  }

  set(next: GameState): void {
    this.state = next;
    for (const l of this.listeners) l(this.state);
  }

  update(fn: (draft: GameState) => void): void {
    const draft: GameState = {
      ...this.state,
      inventory: { ...this.state.inventory },
      floor: { ...this.state.floor },
      jobs: [...this.state.jobs],
      actionJob: this.state.actionJob ? { ...this.state.actionJob } : null,
      nodeCharges: { ...this.state.nodeCharges },
      discoveredBiomes: { ...this.state.discoveredBiomes },
      rooms: this.state.rooms.map((r) => ({
        ...r,
        cells: r.cells.map((c) =>
          c.kind === "machine"
            ? { ...c, output: { ...c.output } }
            : {
                ...c,
                contents: { ...c.contents },
                perishables: Object.fromEntries(
                  Object.entries(c.perishables).map(([k, v]) => [
                    k,
                    v.map((b) => ({ ...b })),
                  ]),
                ),
              },
        ),
      })),
      everBuilt: { ...this.state.everBuilt },
      completedQuests: [...this.state.completedQuests],
      pinnedRecipes: [...this.state.pinnedRecipes],
      perishables: Object.fromEntries(
        Object.entries(this.state.perishables).map(([k, v]) => [
          k,
          v.map((b) => ({ ...b })),
        ]),
      ),
    };
    fn(draft);
    evaluateQuests(draft);
    this.set(draft);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const store = new Store();

// Game clock: wall-clock minus accumulated idle time. In-game time only
// passes while the player has a foreground actionJob in flight, so machine
// jobs (anchored to gameNow) freeze whenever the player is idle. The
// drift accumulator also covers tab-closed periods via save/load.
let pauseDriftMs = 0;
let lastSampledAt = Date.now();

/** Wall-clock time, paused while no foreground action is in flight. */
export function gameNow(): number {
  const now = Date.now();
  const delta = now - lastSampledAt;
  lastSampledAt = now;
  if (delta > 0 && !store.get().actionJob) {
    pauseDriftMs += delta;
  }
  return now - pauseDriftMs;
}

// Tick listeners fire on a steady interval so progress bars can repaint
// without forcing a full state mutation every frame.
const tickListeners = new Set<() => void>();
export function onTick(fn: () => void): () => void {
  tickListeners.add(fn);
  return () => tickListeners.delete(fn);
}

// ---- inventory helpers ----

export function count(state: GameState, id: ItemId): number {
  return state.inventory[id] ?? 0;
}

/** Slots an item map currently occupies. */
function slotsUsedIn(map: Record<ItemId, number>): number {
  let total = 0;
  for (const [id, qty] of Object.entries(map)) {
    if (qty <= 0) continue;
    total += Math.ceil(qty / stackSize(id));
  }
  return total;
}

export function inventorySlotsUsed(state: GameState): number {
  return slotsUsedIn(state.inventory);
}

/** Sum of carry-gear bonuses the player owns. A pouch and a pack stack. */
export function totalCarryBonus(state: GameState): number {
  let sum = 0;
  for (const id of Object.keys(state.inventory)) {
    const bonus = ITEMS[id]?.carryBonus;
    if (bonus !== undefined) sum += bonus;
  }
  return sum;
}

export function carryCap(state: GameState): number {
  return BASE_CARRY_SLOTS + totalCarryBonus(state);
}

/**
 * Add qty of item to inventory, respecting the carry cap. Anything that
 * doesn't fit goes onto the workshop floor.
 */
export function add(state: GameState, id: ItemId, qty: number): void {
  if (qty <= 0) return;
  const stack = stackSize(id);
  const cap = carryCap(state);
  const used = inventorySlotsUsed(state);
  const currentQty = state.inventory[id] ?? 0;
  const currentSlots = Math.ceil(currentQty / stack);
  // Available slots for this item = total cap minus other items' slots.
  const availableSlots = cap - (used - currentSlots);
  const maxQty = Math.max(0, availableSlots * stack);
  const canAdd = Math.max(0, Math.min(qty, maxQty - currentQty));
  if (canAdd > 0) state.inventory[id] = currentQty + canAdd;
  const overflow = qty - canAdd;
  if (overflow > 0) state.floor[id] = (state.floor[id] ?? 0) + overflow;
  // Perishables: each gather pushes its own batch onto the FIFO so freshly
  // picked food keeps its full shelf life regardless of older stock.
  const perish = ITEMS[id]?.spoilsAfter;
  if (perish) {
    const batches = state.perishables[id] ?? [];
    batches.push({ qty, expiresAt: gameMinutes(state) + perish });
    state.perishables[id] = batches;
  }
}

/**
 * Drain `amount` units from the front of the FIFO batches for `id`. Used
 * whenever items leave inventory+floor for any reason (eating, crafting,
 * trashing). Older batches go first. Returns the batches that were taken
 * (with their original expiresAt) so callers that move items elsewhere
 * (e.g. into a chest) can preserve freshness.
 */
function consumeFromBatches(
  map: Record<ItemId, PerishableBatch[]>,
  id: ItemId,
  amount: number,
): PerishableBatch[] {
  if (amount <= 0) return [];
  const batches = map[id];
  if (!batches || batches.length === 0) return [];
  const taken: PerishableBatch[] = [];
  let remaining = amount;
  while (remaining > 0 && batches.length > 0) {
    const head = batches[0]!;
    if (head.qty <= remaining) {
      remaining -= head.qty;
      taken.push(batches.shift()!);
    } else {
      taken.push({ qty: remaining, expiresAt: head.expiresAt });
      head.qty -= remaining;
      remaining = 0;
    }
  }
  if (batches.length === 0) delete map[id];
  return taken;
}

function consumePerishable(
  state: GameState,
  id: ItemId,
  amount: number,
): PerishableBatch[] {
  return consumeFromBatches(state.perishables, id, amount);
}

/**
 * Multiply each batch's *remaining* shelf life (expiresAt − now) by `factor`
 * and return a fresh batch list. Used by preserving chests on deposit
 * (factor > 1) and on withdrawal (1 / factor) so a round trip is neutral.
 * Already-expired batches pass through untouched — they should rot promptly.
 */
function scaleBatchRemaining(
  batches: PerishableBatch[],
  now: number,
  factor: number,
): PerishableBatch[] {
  if (factor === 1 || batches.length === 0) return batches;
  return batches.map((b) => {
    const remaining = b.expiresAt - now;
    if (remaining <= 0) return { ...b };
    return { qty: b.qty, expiresAt: now + remaining * factor };
  });
}

/** Insert `incoming` batches into `target` keeping the list sorted oldest-first. */
function mergeBatches(
  target: PerishableBatch[],
  incoming: PerishableBatch[],
): PerishableBatch[] {
  if (incoming.length === 0) return target;
  const merged = target.concat(incoming);
  merged.sort((a, b) => a.expiresAt - b.expiresAt);
  return merged;
}

/**
 * Advance spoilage to the current game time. Any perishable whose timer has
 * elapsed is destroyed (inventory + floor) and its name returned so the UI
 * can surface a toast.
 */
export function tickSpoilage(state: GameState): ItemId[] {
  const now = gameMinutes(state);
  const expired = new Set<ItemId>();
  // Player's inventory + floor.
  for (const [id, batches] of Object.entries(state.perishables)) {
    let lost = 0;
    while (batches.length > 0 && batches[0]!.expiresAt <= now) {
      lost += batches.shift()!.qty;
    }
    if (batches.length === 0) delete state.perishables[id];
    if (lost <= 0) continue;
    const fromInv = Math.min(state.inventory[id] ?? 0, lost);
    if (fromInv > 0) {
      state.inventory[id] = (state.inventory[id] ?? 0) - fromInv;
      if (state.inventory[id]! <= 0) delete state.inventory[id];
    }
    const fromFloor = lost - fromInv;
    if (fromFloor > 0) {
      state.floor[id] = (state.floor[id] ?? 0) - fromFloor;
      if (state.floor[id]! <= 0) delete state.floor[id];
    }
    expired.add(id);
  }
  // Every placed chest spoils on the same clock — chests aren't fridges.
  for (const room of state.rooms) {
    for (const cell of room.cells) {
      if (cell.kind !== "chest") continue;
      for (const [id, batches] of Object.entries(cell.perishables)) {
        let lost = 0;
        while (batches.length > 0 && batches[0]!.expiresAt <= now) {
          lost += batches.shift()!.qty;
        }
        if (batches.length === 0) delete cell.perishables[id];
        if (lost <= 0) continue;
        cell.contents[id] = (cell.contents[id] ?? 0) - lost;
        if (cell.contents[id]! <= 0) delete cell.contents[id];
        expired.add(id);
      }
    }
  }
  return [...expired];
}

/** Apply a recipe's outputs and remember any machine that was just built for the first time. */
function applyRecipeOutputs(state: GameState, recipe: Recipe): void {
  for (const o of recipe.outputs) {
    add(state, o.item, o.qty);
    if (MACHINES[o.item]) state.everBuilt[o.item] = true;
  }
}

/** Strict inventory-only consume. Used for room building and any "must be on hand" checks. */
export function tryConsume(state: GameState, stacks: Stack[]): boolean {
  for (const s of stacks) {
    if ((state.inventory[s.item] ?? 0) < s.qty) return false;
  }
  for (const s of stacks) {
    state.inventory[s.item] = (state.inventory[s.item] ?? 0) - s.qty;
    if (state.inventory[s.item]! <= 0) delete state.inventory[s.item];
    consumePerishable(state, s.item, s.qty);
  }
  return true;
}

/** Total qty of an item available across player inventory + every chest. */
export function totalAvailable(state: GameState, id: ItemId): number {
  let total = state.inventory[id] ?? 0;
  for (const r of state.rooms) {
    for (const c of r.cells) {
      if (c.kind === "chest") total += c.contents[id] ?? 0;
    }
  }
  return total;
}

/**
 * Total qty available across every item carrying the given tag. Used by
 * tag-based recipe inputs (e.g. "any berry").
 */
export function totalAvailableForTag(state: GameState, tag: string): number {
  let total = 0;
  for (const it of itemsWithTag(tag)) {
    total += totalAvailable(state, it.id);
  }
  return total;
}

export function totalAvailableForInput(state: GameState, input: RecipeInput): number {
  return isTagInput(input)
    ? totalAvailableForTag(state, input.tag)
    : totalAvailable(state, input.item);
}

/**
 * For a tag input, build the order in which we'll spend matching items.
 * Sorts by oldest perishable batch first (closest to spoiling), then
 * non-perishables last — using up vulnerable food before it rots.
 */
function tagSpendOrder(state: GameState, tag: string): ItemId[] {
  const candidates = itemsWithTag(tag).filter((it) => totalAvailable(state, it.id) > 0);
  const earliestExpiry = (id: ItemId): number => {
    let best = Infinity;
    const inv = state.perishables[id];
    if (inv && inv.length > 0) best = Math.min(best, inv[0]!.expiresAt);
    for (const r of state.rooms) {
      for (const c of r.cells) {
        if (c.kind !== "chest") continue;
        const batches = c.perishables[id];
        if (batches && batches.length > 0) best = Math.min(best, batches[0]!.expiresAt);
      }
    }
    return best;
  };
  return candidates
    .map((it) => ({ id: it.id, expiry: earliestExpiry(it.id) }))
    .sort((a, b) => a.expiry - b.expiry)
    .map((c) => c.id);
}

/**
 * Lenient consume: pulls from inventory first, then from any chest in any room.
 * Used by recipe crafting so chests act as a shared pantry. Accepts both
 * concrete `Stack` inputs and tag inputs (any item carrying a given tag).
 */
function tryConsumeLenient(state: GameState, inputs: readonly RecipeInput[]): boolean {
  for (const i of inputs) {
    if (totalAvailableForInput(state, i) < i.qty) return false;
  }
  for (const i of inputs) {
    if (isTagInput(i)) {
      let need = i.qty;
      for (const id of tagSpendOrder(state, i.tag)) {
        if (need <= 0) break;
        const take = Math.min(need, totalAvailable(state, id));
        if (take > 0) {
          consumeOneItem(state, id, take);
          need -= take;
        }
      }
    } else {
      consumeOneItem(state, i.item, i.qty);
    }
  }
  return true;
}

/** Pull `qty` of a specific item from inventory then chests, oldest perishable first. */
function consumeOneItem(state: GameState, id: ItemId, qty: number): void {
  let need = qty;
  const fromInv = Math.min(need, state.inventory[id] ?? 0);
  if (fromInv > 0) {
    state.inventory[id] = (state.inventory[id] ?? 0) - fromInv;
    if (state.inventory[id]! <= 0) delete state.inventory[id];
    consumePerishable(state, id, fromInv);
    need -= fromInv;
  }
  if (need <= 0) return;
  for (const r of state.rooms) {
    for (const cell of r.cells) {
      if (need <= 0) break;
      if (cell.kind !== "chest") continue;
      const have = cell.contents[id] ?? 0;
      if (have <= 0) continue;
      const take = Math.min(have, need);
      cell.contents[id] = have - take;
      if (cell.contents[id]! <= 0) delete cell.contents[id];
      consumeFromBatches(cell.perishables, id, take);
      need -= take;
    }
    if (need <= 0) break;
  }
}

// ---- tool helpers ----

/** Highest tier of a given tool type that the player owns. -Infinity if none. */
export function bestToolTier(
  state: GameState,
  type: ToolRequirement["type"],
): number {
  let best = -Infinity;
  for (const id of Object.keys(state.inventory)) {
    const tool = ITEMS[id]?.tool;
    if (tool && tool.type === type && tool.tier > best) best = tool.tier;
  }
  return best;
}

export function meetsToolReq(state: GameState, req: ToolRequirement | undefined): boolean {
  if (!req) return true;
  return bestToolTier(state, req.type) >= req.minTier;
}

/** Highest tier of a given tool type owned anywhere (inventory, chests, floor). */
export function ownedToolTier(
  state: GameState,
  type: ToolRequirement["type"],
): number {
  let best = -Infinity;
  for (const id of Object.keys(ITEMS)) {
    const tool = ITEMS[id]?.tool;
    if (!tool || tool.type !== type) continue;
    const qty =
      (state.inventory[id] ?? 0) +
      (state.floor[id] ?? 0) +
      state.rooms.reduce(
        (n, r) =>
          n +
          r.cells.reduce(
            (m, c) => m + (c.kind === "chest" ? (c.contents[id] ?? 0) : 0),
            0,
          ),
        0,
      );
    if (qty > 0 && tool.tier > best) best = tool.tier;
  }
  return best;
}

/** Total qty of an item across inventory, floor, and chests. */
export function ownedQty(state: GameState, itemId: ItemId): number {
  return (
    (state.inventory[itemId] ?? 0) +
    (state.floor[itemId] ?? 0) +
    state.rooms.reduce(
      (n, r) =>
        n +
        r.cells.reduce(
          (m, c) => m + (c.kind === "chest" ? (c.contents[itemId] ?? 0) : 0),
          0,
        ),
      0,
    )
  );
}

/**
 * True if every output of the recipe is already owned in a way that makes
 * re-crafting pointless: a tool the player already has at equal/higher tier,
 * or a one-time item the player already owns. Hides redundant crafts.
 */
export function producesObsoleteCraft(state: GameState, recipe: Recipe): boolean {
  if (recipe.outputs.length === 0) return false;
  for (const out of recipe.outputs) {
    const item = ITEMS[out.item];
    if (!item) return false;
    const tool = item.tool;
    if (tool) {
      if (ownedToolTier(state, tool.type) < tool.tier) return false;
      continue;
    }
    if (item.oneTime) {
      if (ownedQty(state, out.item) <= 0) return false;
      continue;
    }
    return false;
  }
  return true;
}

// ---- machine instances & capacity ----

/** All placed machine instances of the given type, across all rooms. */
export function machineInstancesFor(
  state: GameState,
  machineId: MachineId,
): PlacedMachine[] {
  const out: PlacedMachine[] = [];
  for (const r of state.rooms) {
    for (const c of r.cells) {
      if (c.kind === "machine" && c.machineId === machineId) out.push(c);
    }
  }
  return out;
}

/** Total of a given machine type placed across all rooms. */
export function placedMachineCount(state: GameState, machineId: MachineId): number {
  return machineInstancesFor(state, machineId).length;
}

/** Total slots available for a machine. Hand always has 1; everything else must be placed in a room. */
export function machineCapacity(state: GameState, machineId: MachineId): number {
  if (machineId === "hand") return 1;
  return placedMachineCount(state, machineId);
}

export function activeJobsFor(state: GameState, machineId: MachineId): MachineJob[] {
  return state.jobs.filter((j) => j.machineId === machineId);
}

export function freeSlotsFor(state: GameState, machineId: MachineId): number {
  if (machineId === "hand") return 1;
  return machineInstancesFor(state, machineId).filter((m) => !m.jobId).length;
}

/** Find a placed machine instance by id, plus the room it lives in. */
export function findMachineInstance(
  state: GameState,
  instanceId: string,
): { roomId: string; cell: PlacedMachine } | null {
  for (const r of state.rooms) {
    for (const c of r.cells) {
      if (c.kind === "machine" && c.instanceId === instanceId) {
        return { roomId: r.id, cell: c };
      }
    }
  }
  return null;
}

/** Find a placed chest instance by id, plus the room it lives in. */
export function findChestInstance(
  state: GameState,
  instanceId: string,
): { roomId: string; cell: PlacedChest } | null {
  for (const r of state.rooms) {
    for (const c of r.cells) {
      if (c.kind === "chest" && c.instanceId === instanceId) {
        return { roomId: r.id, cell: c };
      }
    }
  }
  return null;
}

/** Active job for a specific machine instance, if any. */
export function jobForInstance(
  state: GameState,
  instanceId: string,
): MachineJob | null {
  return state.jobs.find((j) => j.instanceId === instanceId) ?? null;
}

// ---- recipe / gather actions ----

export interface CraftResult {
  ok: boolean;
  reason?: "missing_inputs" | "missing_tool" | "machine_busy" | "wrong_season";
}

export function inSeason(state: GameState, recipe: Recipe): boolean {
  return !recipe.seasons || recipe.seasons.includes(state.seasonIndex);
}

export function hasInputsAndTool(state: GameState, recipe: Recipe): boolean {
  if (!meetsToolReq(state, recipe.tool)) return false;
  if (!inSeason(state, recipe)) return false;
  for (const i of recipe.inputs) {
    if (totalAvailableForInput(state, i) < i.qty) return false;
  }
  return true;
}

/** Same as hasInputsAndTool but ignoring the season check — used by UIs that show off-season recipes greyed out. */
export function hasInputsAndToolIgnoringSeason(state: GameState, recipe: Recipe): boolean {
  if (!meetsToolReq(state, recipe.tool)) return false;
  for (const i of recipe.inputs) {
    if (totalAvailableForInput(state, i) < i.qty) return false;
  }
  return true;
}

export function canCraft(state: GameState, recipe: Recipe): CraftResult {
  if (!meetsToolReq(state, recipe.tool)) return { ok: false, reason: "missing_tool" };
  if (!inSeason(state, recipe)) return { ok: false, reason: "wrong_season" };
  for (const i of recipe.inputs) {
    if (totalAvailableForInput(state, i) < i.qty) return { ok: false, reason: "missing_inputs" };
  }
  if (freeSlotsFor(state, recipe.machine) < 1) return { ok: false, reason: "machine_busy" };
  return { ok: true };
}

let jobSeq = 0;
function newJobId(): string {
  jobSeq += 1;
  return `${Date.now().toString(36)}-${jobSeq}`;
}

/** Add a recipe's outputs into a placed machine's output buffer. */
function depositOutputsToInstance(
  state: GameState,
  cell: PlacedMachine,
  recipe: Recipe,
): void {
  for (const o of recipe.outputs) {
    cell.output[o.item] = (cell.output[o.item] ?? 0) + o.qty;
    if (MACHINES[o.item]) {
      // Tracked at the state level — handled in tickJobs / craftAt callers via applyRecipeOutputs.
    }
  }
  // Plot recipes set a deadline: leave the harvest sitting too long and the
  // produce is lost — only the seed remains. The seed is the recipe's
  // first input (every plant_* recipe sows from one seed item).
  if (recipe.goToSeedDays !== undefined) {
    const seedInput = recipe.inputs[0];
    const seedItem = seedInput && !isTagInput(seedInput) ? seedInput.item : undefined;
    if (seedItem) {
      cell.outputGoesToSeedAt = gameMinutes(state) + recipe.goToSeedDays * state.dayLength;
      cell.outputSeedItem = seedItem;
    }
  }
}

/**
 * Craft a recipe. For hand recipes outputs go straight to inventory; for
 * machine recipes the call is forwarded to the first idle instance and outputs
 * land in that instance's output buffer.
 */
export function craft(recipeId: RecipeId): CraftResult {
  const recipe = RECIPES[recipeId];
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);
  if (recipe.machine !== "hand") {
    const idle = machineInstancesFor(store.get(), recipe.machine).find(
      (m) => !m.jobId,
    );
    if (!idle) return { ok: false, reason: "machine_busy" };
    return craftAt(idle.instanceId, recipeId);
  }
  let result: CraftResult = { ok: false };
  store.update((s) => {
    const check = canCraft(s, recipe);
    if (!check.ok) {
      result = check;
      return;
    }
    if (!tryConsumeLenient(s, recipe.inputs)) {
      result = { ok: false, reason: "missing_inputs" };
      return;
    }
    const dur = recipe.durationMs ?? 0;
    if (dur <= 0) {
      applyRecipeOutputs(s, recipe);
    } else {
      const now = gameNow();
      s.jobs.push({
        id: newJobId(),
        machineId: recipe.machine,
        instanceId: null,
        recipeId: recipe.id,
        startedAt: now,
        endsAt: now + dur * DURATION_SCALE,
      });
    }
    result = { ok: true };
  });
  return result;
}

/** Run a recipe at a specific placed machine. Outputs go into the machine's output buffer. */
export function craftAt(instanceId: string, recipeId: RecipeId): CraftResult {
  const recipe = RECIPES[recipeId];
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);
  let result: CraftResult = { ok: false };
  store.update((s) => {
    const found = findMachineInstance(s, instanceId);
    if (!found || found.cell.machineId !== recipe.machine) {
      result = { ok: false, reason: "machine_busy" };
      return;
    }
    if (found.cell.jobId) {
      result = { ok: false, reason: "machine_busy" };
      return;
    }
    if (!meetsToolReq(s, recipe.tool)) {
      result = { ok: false, reason: "missing_tool" };
      return;
    }
    if (!inSeason(s, recipe)) {
      result = { ok: false, reason: "wrong_season" };
      return;
    }
    for (const i of recipe.inputs) {
      if (totalAvailableForInput(s, i) < i.qty) {
        result = { ok: false, reason: "missing_inputs" };
        return;
      }
    }
    if (!tryConsumeLenient(s, recipe.inputs)) {
      result = { ok: false, reason: "missing_inputs" };
      return;
    }
    const dur = recipe.durationMs ?? 0;
    if (dur <= 0) {
      depositOutputsToInstance(s, found.cell, recipe);
      for (const o of recipe.outputs) {
        if (MACHINES[o.item]) s.everBuilt[o.item] = true;
      }
    } else {
      const now = gameNow();
      const jobId = newJobId();
      found.cell.jobId = jobId;
      s.jobs.push({
        id: jobId,
        machineId: recipe.machine,
        instanceId: found.cell.instanceId,
        recipeId: recipe.id,
        startedAt: now,
        endsAt: now + dur * DURATION_SCALE,
      });
    }
    result = { ok: true };
  });
  return result;
}

/** Move output buffer contents back into the player's inventory (overflow → floor). */
export function takeMachineOutput(instanceId: string, itemId?: ItemId): boolean {
  let ok = false;
  store.update((s) => {
    const found = findMachineInstance(s, instanceId);
    if (!found) return;
    const ids = itemId ? [itemId] : Object.keys(found.cell.output);
    for (const id of ids) {
      const qty = found.cell.output[id] ?? 0;
      if (qty <= 0) continue;
      delete found.cell.output[id];
      add(s, id, qty);
      ok = true;
    }
    // Once the buffer is empty, the plot's go-to-seed deadline doesn't
    // apply — clear it so the next planting starts fresh.
    if (Object.values(found.cell.output).every((q) => q <= 0)) {
      delete found.cell.outputGoesToSeedAt;
      delete found.cell.outputSeedItem;
    }
  });
  return ok;
}

/** Complete any jobs whose endsAt has passed. Returns true if any changed. */
export function tickJobs(now: number = gameNow()): boolean {
  const s = store.get();
  const machineDue = s.jobs.some((j) => j.endsAt <= now);
  const actionDue = s.actionJob !== null && s.actionJob.endsAt <= now;
  if (!machineDue && !actionDue) return false;
  store.update((draft) => {
    const remaining: MachineJob[] = [];
    for (const j of draft.jobs) {
      if (j.endsAt > now) {
        remaining.push(j);
        continue;
      }
      const r = RECIPES[j.recipeId];
      if (!r) continue;
      if (j.instanceId) {
        const found = findMachineInstance(draft, j.instanceId);
        if (found) {
          depositOutputsToInstance(draft, found.cell, r);
          for (const o of r.outputs) {
            if (MACHINES[o.item]) draft.everBuilt[o.item] = true;
          }
          found.cell.jobId = null;
        }
        // else: instance was somehow removed; output is lost.
      } else {
        applyRecipeOutputs(draft, r);
      }
    }
    draft.jobs = remaining;
    if (draft.actionJob && draft.actionJob.endsAt <= now) {
      finishActionJob(draft, draft.actionJob);
      draft.actionJob = null;
    }
  });
  return true;
}

export function startTickLoop(intervalMs = 200): () => void {
  const handle = setInterval(() => {
    tickJobs(gameNow());
    for (const l of tickListeners) l();
  }, intervalMs);
  return () => clearInterval(handle);
}

/** Best (shortest) duration among matching speedups, or base if none match. */
function speedupDuration(
  state: GameState,
  baseMs: number,
  speedups: GatherSpeedup[] | undefined,
): number {
  let best = baseMs;
  for (const sp of speedups ?? []) {
    if (bestToolTier(state, sp.type) >= sp.minTier && sp.durationMs < best) {
      best = sp.durationMs;
    }
  }
  return best;
}

/** Duration of a gather action given the player's current tools. */
export function gatherDuration(state: GameState, action: GatherAction): number {
  return speedupDuration(state, action.baseDurationMs, action.speedups);
}

/** Duration of harvesting a node given the player's current tools. */
export function nodeHarvestDuration(state: GameState, node: ResourceNode): number {
  return speedupDuration(state, node.baseDurationMs, node.speedups);
}

/** In-world minutes a gather action takes. Derived from baseDurationMs at the global time scale unless overridden. */
export function gatherActiveTime(action: GatherAction): number {
  return action.activeTime ?? realMsToGameMinutes(action.baseDurationMs);
}

/** In-world minutes a harvest takes. */
export function nodeActiveTime(node: ResourceNode): number {
  return node.activeTime ?? realMsToGameMinutes(node.baseDurationMs);
}

/** In-world minutes spent exploring a biome. */
export function biomeActiveTime(biome: Biome): number {
  return biome.activeTime ?? realMsToGameMinutes(biome.exploreDurationMs);
}

/** In-world minutes spent on a wander. */
export function wanderActiveTime(): number {
  return WANDER_ACTIVE_TIME;
}

/**
 * Whether the player has time-of-day to start an action of the given length.
 * Day-length cap is hard: even Forage Nearby can't push past dayLength.
 */
export function fitsInDay(state: GameState, activeTime: number): boolean {
  return state.worldClock + activeTime <= state.dayLength;
}

/**
 * Whether the player has food-budget to pay for an action of the given length.
 * Forage Nearby is always allowed (treated as free if budget would block).
 */
export function canAfford(state: GameState, activeTime: number, isFloor: boolean): boolean {
  if (isFloor) return true;
  return state.timeBudget >= activeTime;
}

function rollDrops(state: GameState, drops: DropEntry[]): Record<ItemId, number> {
  const got: Record<ItemId, number> = {};
  for (const drop of drops) {
    if (drop.seasons && !drop.seasons.includes(state.seasonIndex)) continue;
    if (!meetsToolReq(state, drop.requiresTool)) continue;
    if (drop.requiresMachineEverBuilt && !state.everBuilt[drop.requiresMachineEverBuilt]) continue;
    if (Math.random() > drop.chance) continue;
    const qty = randInt(drop.qty[0], drop.qty[1]);
    got[drop.item] = (got[drop.item] ?? 0) + qty;
  }
  return got;
}

function applyDrops(state: GameState, drops: DropEntry[]): void {
  const got = rollDrops(state, drops);
  for (const [item, qty] of Object.entries(got)) add(state, item, qty);
}

function finishActionJob(state: GameState, job: ActionJob): void {
  if (job.kind === "gather") {
    const action = GATHER_ACTIONS[job.gatherId];
    if (action) applyDrops(state, action.drops);
  } else if (job.kind === "harvest") {
    const node = NODES[job.nodeId];
    if (!node) return;
    // Charges already debited at start of harvest; just apply drops.
    applyDrops(state, node.drops);
  } else if (job.kind === "explore") {
    const biome = BIOMES[job.biomeId];
    if (!biome) return;
    const outcome = pickOutcome(biome, state.seasonIndex);
    if (!outcome) return;
    state.lastExploreMessage = outcome.message;
    for (const c of outcome.charges) {
      const qty = randInt(c.qty[0], c.qty[1]);
      state.nodeCharges[c.node] = (state.nodeCharges[c.node] ?? 0) + qty;
    }
    if (outcome.drops) applyDrops(state, outcome.drops);
  } else {
    const outcome = pickWanderOutcome(state);
    if (!outcome) return;
    state.lastExploreMessage = outcome.message;
    if (outcome.discoverBiome) {
      state.discoveredBiomes[outcome.discoverBiome] = true;
    }
  }
}

function pickOutcome(biome: Biome, seasonIndex: number): Biome["outcomes"][number] | null {
  const eligible = biome.outcomes.filter(
    (o) => !o.seasons || o.seasons.includes(seasonIndex),
  );
  const total = eligible.reduce((n, o) => n + o.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const o of eligible) {
    roll -= o.weight;
    if (roll <= 0) return o;
  }
  return eligible[eligible.length - 1] ?? null;
}

/** Wander outcomes that can still fire — discovery outcomes drop out once their biome is known. */
function eligibleWanderOutcomes(state: GameState): WanderOutcome[] {
  return WANDER_OUTCOMES.filter(
    (o) => !o.discoverBiome || !state.discoveredBiomes[o.discoverBiome],
  );
}

function pickWanderOutcome(state: GameState): WanderOutcome | null {
  const eligible = eligibleWanderOutcomes(state);
  const total = eligible.reduce((n, o) => n + o.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const o of eligible) {
    roll -= o.weight;
    if (roll <= 0) return o;
  }
  return eligible[eligible.length - 1] ?? null;
}

/** True while there's at least one undiscovered biome that wandering could turn up. */
export function hasUndiscoveredBiomes(state: GameState): boolean {
  return WANDER_OUTCOMES.some(
    (o) => o.discoverBiome && !state.discoveredBiomes[o.discoverBiome],
  );
}

export interface ActionResult {
  ok: boolean;
  reason?:
    | "busy"
    | "unknown"
    | "no_charges"
    | "missing_tool"
    | "no_budget"
    | "no_daytime"
    | "missing_provisions";
}

/** True iff every provision input is available across inventory + chests. */
export function hasProvisions(state: GameState, inputs: RecipeInput[] | undefined): boolean {
  if (!inputs || inputs.length === 0) return true;
  for (const i of inputs) {
    if (totalAvailableForInput(state, i) < i.qty) return false;
  }
  return true;
}

/** Spend the action's active time: drain budget (unless free) and advance the world clock. */
function spendActiveTime(state: GameState, activeTime: number, isFloor: boolean): void {
  const cost = isFloor ? Math.min(activeTime, state.timeBudget) : activeTime;
  state.timeBudget = Math.max(0, state.timeBudget - cost);
  state.worldClock = Math.min(state.dayLength, state.worldClock + activeTime);
  const expired = tickSpoilage(state);
  if (expired.length > 0) reportSpoiled(expired);
}

const spoilListeners = new Set<(ids: ItemId[]) => void>();
export function onSpoiled(fn: (ids: ItemId[]) => void): () => void {
  spoilListeners.add(fn);
  return () => spoilListeners.delete(fn);
}
function reportSpoiled(ids: ItemId[]): void {
  for (const fn of spoilListeners) fn(ids);
}

export function gather(actionId: GatherId): ActionResult {
  const action = GATHER_ACTIONS[actionId];
  if (!action) return { ok: false, reason: "unknown" };
  let result: ActionResult = { ok: false };
  store.update((s) => {
    if (s.actionJob) {
      result = { ok: false, reason: "busy" };
      return;
    }
    const at = gatherActiveTime(action);
    const isFloor = action.id === FLOOR_GATHER_ID;
    if (!fitsInDay(s, at)) {
      result = { ok: false, reason: "no_daytime" };
      return;
    }
    // Forage Nearby auto-eats the cheapest food in inventory before running,
    // so players can't dodge the food loop by spam-foraging on an empty
    // budget. If inventory is empty too, the floor stays free.
    if (isFloor && s.timeBudget < at) {
      autoEatToCover(s, at);
    }
    if (!canAfford(s, at, isFloor)) {
      result = { ok: false, reason: "no_budget" };
      return;
    }
    if (!hasProvisions(s, action.provisions)) {
      result = { ok: false, reason: "missing_provisions" };
      return;
    }
    if (action.provisions && !tryConsumeLenient(s, action.provisions)) {
      result = { ok: false, reason: "missing_provisions" };
      return;
    }
    spendActiveTime(s, at, isFloor);
    const dur = gatherDuration(s, action);
    if (dur <= 0) {
      applyDrops(s, action.drops);
    } else {
      const now = gameNow();
      s.actionJob = { kind: "gather", gatherId: action.id, startedAt: now, endsAt: now + dur * DURATION_SCALE };
    }
    result = { ok: true };
  });
  return result;
}

export function harvestNode(nodeId: NodeId): ActionResult {
  const node = NODES[nodeId];
  if (!node) return { ok: false, reason: "unknown" };
  let result: ActionResult = { ok: false };
  store.update((s) => {
    if (s.actionJob) {
      result = { ok: false, reason: "busy" };
      return;
    }
    if ((s.nodeCharges[nodeId] ?? 0) <= 0) {
      result = { ok: false, reason: "no_charges" };
      return;
    }
    if (!meetsToolReq(s, node.requiresTool)) {
      result = { ok: false, reason: "missing_tool" };
      return;
    }
    const at = nodeActiveTime(node);
    if (!fitsInDay(s, at)) {
      result = { ok: false, reason: "no_daytime" };
      return;
    }
    if (!canAfford(s, at, false)) {
      result = { ok: false, reason: "no_budget" };
      return;
    }
    s.nodeCharges[nodeId] = (s.nodeCharges[nodeId] ?? 0) - 1;
    if (s.nodeCharges[nodeId]! <= 0) delete s.nodeCharges[nodeId];
    spendActiveTime(s, at, false);
    const dur = nodeHarvestDuration(s, node);
    if (dur <= 0) {
      applyDrops(s, node.drops);
    } else {
      const now = gameNow();
      s.actionJob = { kind: "harvest", nodeId, startedAt: now, endsAt: now + dur * DURATION_SCALE };
    }
    result = { ok: true };
  });
  return result;
}

export function exploreBiome(biomeId: BiomeId): ActionResult {
  const biome = BIOMES[biomeId];
  if (!biome) return { ok: false, reason: "unknown" };
  let result: ActionResult = { ok: false };
  store.update((s) => {
    if (s.actionJob) {
      result = { ok: false, reason: "busy" };
      return;
    }
    if (!s.discoveredBiomes[biomeId]) {
      result = { ok: false, reason: "unknown" };
      return;
    }
    const at = biomeActiveTime(biome);
    if (!fitsInDay(s, at)) {
      result = { ok: false, reason: "no_daytime" };
      return;
    }
    if (!canAfford(s, at, false)) {
      result = { ok: false, reason: "no_budget" };
      return;
    }
    if (!hasProvisions(s, biome.provisions)) {
      result = { ok: false, reason: "missing_provisions" };
      return;
    }
    if (biome.provisions && !tryConsumeLenient(s, biome.provisions)) {
      result = { ok: false, reason: "missing_provisions" };
      return;
    }
    spendActiveTime(s, at, false);
    s.lastExploreMessage = null;
    const dur = biome.exploreDurationMs;
    if (dur <= 0) {
      finishActionJob(s, { kind: "explore", biomeId, startedAt: 0, endsAt: 0 });
    } else {
      const now = gameNow();
      s.actionJob = { kind: "explore", biomeId, startedAt: now, endsAt: now + dur * DURATION_SCALE };
    }
    result = { ok: true };
  });
  return result;
}

export function wander(): ActionResult {
  let result: ActionResult = { ok: false };
  store.update((s) => {
    if (s.actionJob) {
      result = { ok: false, reason: "busy" };
      return;
    }
    const at = wanderActiveTime();
    if (!fitsInDay(s, at)) {
      result = { ok: false, reason: "no_daytime" };
      return;
    }
    if (!canAfford(s, at, false)) {
      result = { ok: false, reason: "no_budget" };
      return;
    }
    spendActiveTime(s, at, false);
    s.lastExploreMessage = null;
    const now = gameNow();
    s.actionJob = { kind: "wander", startedAt: now, endsAt: now + WANDER_DURATION_MS * DURATION_SCALE };
    result = { ok: true };
  });
  return result;
}

// ---- food / sleep ----

/** Eat one unit of a food item from inventory. Refunds time-budget, capped at dayLength. */
export function eat(itemId: ItemId): boolean {
  let ok = false;
  store.update((s) => {
    ok = eatOne(s, itemId);
  });
  return ok;
}

function eatOne(s: GameState, itemId: ItemId): boolean {
  const item: Item | undefined = ITEMS[itemId];
  if (!item?.food) return false;
  if ((s.inventory[itemId] ?? 0) <= 0) return false;
  s.inventory[itemId] = s.inventory[itemId]! - 1;
  if (s.inventory[itemId]! <= 0) delete s.inventory[itemId];
  consumePerishable(s, itemId, 1);
  s.timeBudget = Math.min(s.dayLength, s.timeBudget + item.food.satiatesMinutes);
  return true;
}

/** Lowest-satiation food currently in the player's inventory, or null. */
function cheapestFoodInInventory(s: GameState): ItemId | null {
  let bestId: ItemId | null = null;
  let bestM = Infinity;
  for (const [id, qty] of Object.entries(s.inventory)) {
    if ((qty ?? 0) <= 0) continue;
    const food = ITEMS[id]?.food;
    if (!food) continue;
    if (food.satiatesMinutes < bestM) {
      bestM = food.satiatesMinutes;
      bestId = id;
    }
  }
  return bestId;
}

/**
 * Top up the player's time-budget by auto-eating their cheapest food until
 * `needed` minutes are covered, or no food remains. Without this, the player
 * could spam Forage Nearby forever to skip eating entirely.
 */
function autoEatToCover(s: GameState, needed: number): void {
  while (s.timeBudget < needed) {
    const id = cheapestFoodInInventory(s);
    if (!id) return;
    if (!eatOne(s, id)) return;
  }
}

/**
 * Pure preview of which items Forage Nearby would auto-consume right now.
 * Returns an empty list if the player already has enough budget or no food.
 */
export function forageAutoEatPreview(s: GameState): { item: ItemId; qty: number }[] {
  const action = GATHER_ACTIONS[FLOOR_GATHER_ID];
  if (!action) return [];
  const needed = gatherActiveTime(action);
  if (s.timeBudget >= needed) return [];
  let budget = s.timeBudget;
  const inv: Record<ItemId, number> = { ...s.inventory };
  const eaten: Record<ItemId, number> = {};
  while (budget < needed) {
    let bestId: ItemId | null = null;
    let bestM = Infinity;
    for (const [id, qty] of Object.entries(inv)) {
      if ((qty ?? 0) <= 0) continue;
      const food = ITEMS[id]?.food;
      if (!food) continue;
      if (food.satiatesMinutes < bestM) {
        bestM = food.satiatesMinutes;
        bestId = id;
      }
    }
    if (!bestId) break;
    inv[bestId] = (inv[bestId] ?? 0) - 1;
    eaten[bestId] = (eaten[bestId] ?? 0) + 1;
    budget = Math.min(s.dayLength, budget + bestM);
  }
  return Object.entries(eaten).map(([item, qty]) => ({ item, qty }));
}

/**
 * Walk every placed machine and convert any harvest whose go-to-seed deadline
 * has passed: keep one seed, lose the rest. Returns the seed ids that were
 * salvaged, so the UI can flag the loss.
 */
function applyGoToSeed(state: GameState): ItemId[] {
  const now = gameMinutes(state);
  const lost: ItemId[] = [];
  for (const r of state.rooms) {
    for (const cell of r.cells) {
      if (cell.kind !== "machine") continue;
      const due = cell.outputGoesToSeedAt;
      if (due === undefined || due > now) continue;
      const seed = cell.outputSeedItem;
      const hadOutput = Object.values(cell.output).some((q) => q > 0);
      if (hadOutput && seed) {
        cell.output = { [seed]: 1 };
        lost.push(seed);
      }
      delete cell.outputGoesToSeedAt;
      delete cell.outputSeedItem;
    }
  }
  return lost;
}

const goToSeedListeners = new Set<(ids: ItemId[]) => void>();
export function onGoToSeed(fn: (ids: ItemId[]) => void): () => void {
  goToSeedListeners.add(fn);
  return () => goToSeedListeners.delete(fn);
}
function reportGoToSeed(ids: ItemId[]): void {
  if (ids.length === 0) return;
  for (const fn of goToSeedListeners) fn(ids);
}

/**
 * Sleep until dawn. Resets the world clock, bumps the day, and fast-forwards
 * any in-flight machine jobs by the slept real-time gap so they look like
 * they ran while the player rested. Sleep itself costs no food.
 */
export function sleep(): boolean {
  let ok = false;
  let wentToSeed: ItemId[] = [];
  store.update((s) => {
    if (s.actionJob) return;
    const sleptMinutes = s.dayLength - s.worldClock;
    if (sleptMinutes <= 0 && s.dayNumber !== 0) {
      // Already at end of day — still allow sleeping (rolls to next morning).
    }
    // Fast-forward machine job timestamps so they continue from the new dawn.
    // Job timestamps live in game-clock ms (paused while idle); shifting them
    // back by the slept duration converts the slept rest into machine progress.
    const realMsPerMinute = 1000 * DURATION_SCALE;
    const shiftMs = Math.max(0, sleptMinutes) * realMsPerMinute;
    if (shiftMs > 0) {
      for (const j of s.jobs) {
        j.startedAt -= shiftMs;
        j.endsAt -= shiftMs;
      }
    }
    s.worldClock = 0;
    s.dayNumber += 1;
    s.seasonIndex = Math.floor((s.dayNumber - 1) / DAYS_PER_SEASON) % SEASONS.length;
    const expired = tickSpoilage(s);
    if (expired.length > 0) reportSpoiled(expired);
    wentToSeed = applyGoToSeed(s);
    ok = true;
  });
  if (ok) tickJobs();
  if (wentToSeed.length > 0) reportGoToSeed(wentToSeed);
  return ok;
}

function randInt(lo: number, hi: number): number {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

// ---- floor pile ----

/**
 * Move as many of `id` as fit from the floor into inventory; leave the rest.
 * Bypasses `add()` so perishable batches (which span inv+floor) aren't reset.
 */
function moveFromFloor(state: GameState, id: ItemId): void {
  const totalQty = state.floor[id] ?? 0;
  if (totalQty <= 0) return;
  const stack = stackSize(id);
  const cap = carryCap(state);
  const used = inventorySlotsUsed(state);
  const currentQty = state.inventory[id] ?? 0;
  const currentSlots = Math.ceil(currentQty / stack);
  const availableSlots = cap - (used - currentSlots);
  const maxQty = Math.max(0, availableSlots * stack);
  const moveQty = Math.max(0, Math.min(totalQty, maxQty - currentQty));
  if (moveQty <= 0) return;
  state.inventory[id] = currentQty + moveQty;
  const leftover = totalQty - moveQty;
  if (leftover > 0) state.floor[id] = leftover;
  else delete state.floor[id];
}

/** Pick up everything from the floor that fits into inventory; leave the rest. */
export function pickUpAllFromFloor(): void {
  store.update((s) => {
    for (const id of Object.keys(s.floor)) moveFromFloor(s, id);
  });
}

/** Pick up just one item type from the floor. */
export function pickUpFromFloor(id: ItemId): void {
  store.update((s) => {
    moveFromFloor(s, id);
  });
}

// ---- trash ----

/**
 * Snapshot of the most recently discarded stack so the player can undo a
 * fat-finger trash. Only the latest trash is restorable; the next trash
 * (or a successful restore) clears it. Not persisted across reloads.
 */
export type TrashSnapshot =
  | {
      source: "inventory";
      itemId: ItemId;
      qty: number;
      perishables: PerishableBatch[];
    }
  | {
      source: "floor";
      itemId: ItemId;
      qty: number;
      perishables: PerishableBatch[];
    }
  | {
      source: "chest";
      itemId: ItemId;
      qty: number;
      perishables: PerishableBatch[];
      roomId: string;
      chestId: string;
    };

let lastTrashed: TrashSnapshot | null = null;
const lastTrashedListeners = new Set<(s: TrashSnapshot | null) => void>();

function setLastTrashed(snap: TrashSnapshot | null): void {
  lastTrashed = snap;
  for (const cb of lastTrashedListeners) cb(snap);
}

export function getLastTrashed(): TrashSnapshot | null {
  return lastTrashed;
}

export function subscribeLastTrashed(
  cb: (s: TrashSnapshot | null) => void,
): () => void {
  lastTrashedListeners.add(cb);
  return () => lastTrashedListeners.delete(cb);
}

export function clearLastTrashed(): void {
  if (lastTrashed !== null) setLastTrashed(null);
}

/** Discard the entire stack of an item from inventory. */
export function trashFromInventory(id: ItemId): boolean {
  let snap: TrashSnapshot | null = null;
  store.update((s) => {
    const had = s.inventory[id] ?? 0;
    if (had <= 0) return;
    delete s.inventory[id];
    const taken = consumePerishable(s, id, had);
    snap = { source: "inventory", itemId: id, qty: had, perishables: taken };
  });
  if (snap) setLastTrashed(snap);
  return snap !== null;
}

/** Discard the entire stack of an item from the floor pile. */
export function trashFromFloor(id: ItemId): boolean {
  let snap: TrashSnapshot | null = null;
  store.update((s) => {
    const had = s.floor[id] ?? 0;
    if (had <= 0) return;
    delete s.floor[id];
    const taken = consumePerishable(s, id, had);
    snap = { source: "floor", itemId: id, qty: had, perishables: taken };
  });
  if (snap) setLastTrashed(snap);
  return snap !== null;
}

/** Discard the entire stack of an item from a placed chest. */
export function trashFromChest(roomId: string, instanceId: string, id: ItemId): boolean {
  let snap: TrashSnapshot | null = null;
  store.update((s) => {
    const found = findChestInstance(s, instanceId);
    if (!found || found.roomId !== roomId) return;
    const had = found.cell.contents[id] ?? 0;
    if (had <= 0) return;
    const taken = found.cell.perishables[id]
      ? found.cell.perishables[id]!.map((b) => ({ ...b }))
      : [];
    delete found.cell.contents[id];
    delete found.cell.perishables[id];
    snap = {
      source: "chest",
      itemId: id,
      qty: had,
      perishables: taken,
      roomId,
      chestId: instanceId,
    };
  });
  if (snap) setLastTrashed(snap);
  return snap !== null;
}

/**
 * Put the most recently trashed stack back where it came from. Bypasses
 * carry/chest capacity since the items fit a moment ago. Fails if the
 * source chest has since been picked up. Clears the snapshot on success.
 */
export function restoreLastTrashed(): boolean {
  const snap = lastTrashed;
  if (!snap) return false;
  let ok = false;
  store.update((s) => {
    if (snap.source === "inventory") {
      s.inventory[snap.itemId] = (s.inventory[snap.itemId] ?? 0) + snap.qty;
      if (snap.perishables.length > 0) {
        s.perishables[snap.itemId] = mergeBatches(
          s.perishables[snap.itemId] ?? [],
          snap.perishables.map((b) => ({ ...b })),
        );
      }
      ok = true;
    } else if (snap.source === "floor") {
      s.floor[snap.itemId] = (s.floor[snap.itemId] ?? 0) + snap.qty;
      if (snap.perishables.length > 0) {
        s.perishables[snap.itemId] = mergeBatches(
          s.perishables[snap.itemId] ?? [],
          snap.perishables.map((b) => ({ ...b })),
        );
      }
      ok = true;
    } else {
      const found = findChestInstance(s, snap.chestId);
      if (found && found.roomId === snap.roomId) {
        found.cell.contents[snap.itemId] =
          (found.cell.contents[snap.itemId] ?? 0) + snap.qty;
        if (snap.perishables.length > 0) {
          found.cell.perishables[snap.itemId] = mergeBatches(
            found.cell.perishables[snap.itemId] ?? [],
            snap.perishables.map((b) => ({ ...b })),
          );
        }
      } else {
        // Chest is gone — drop it on the floor instead.
        s.floor[snap.itemId] = (s.floor[snap.itemId] ?? 0) + snap.qty;
        if (snap.perishables.length > 0) {
          s.perishables[snap.itemId] = mergeBatches(
            s.perishables[snap.itemId] ?? [],
            snap.perishables.map((b) => ({ ...b })),
          );
        }
      }
      ok = true;
    }
  });
  if (ok) setLastTrashed(null);
  return ok;
}

// ---- rooms ----

let roomSeq = 0;
function newRoomId(): string {
  roomSeq += 1;
  return `room-${Date.now().toString(36)}-${roomSeq}`;
}

let instanceSeq = 0;
function newInstanceId(prefix: string): string {
  instanceSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${instanceSeq}`;
}

export interface BuildRoomResult {
  ok: boolean;
  reason?: "missing_inputs" | "missing_tool";
}

export function canBuildRoom(state: GameState): BuildRoomResult {
  if (!meetsToolReq(state, ROOM_BUILD_TOOL)) return { ok: false, reason: "missing_tool" };
  for (const i of ROOM_BUILD_COST) {
    if ((state.inventory[i.item] ?? 0) < i.qty) return { ok: false, reason: "missing_inputs" };
  }
  return { ok: true };
}

function defaultRoomName(state: GameState): string {
  return `Room ${state.rooms.length + 1}`;
}

export function buildRoom(name?: string): BuildRoomResult {
  let result: BuildRoomResult = { ok: false };
  store.update((s) => {
    const check = canBuildRoom(s);
    if (!check.ok) {
      result = check;
      return;
    }
    if (!tryConsume(s, ROOM_BUILD_COST)) {
      result = { ok: false, reason: "missing_inputs" };
      return;
    }
    const room: Room = {
      id: newRoomId(),
      name: (name && name.trim()) || defaultRoomName(s),
      cells: [],
    };
    s.rooms.push(room);
    result = { ok: true };
  });
  return result;
}

export function renameRoom(roomId: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  store.update((s) => {
    const room = s.rooms.find((r) => r.id === roomId);
    if (room) room.name = trimmed;
  });
}

/** Move a machine from inventory into the given room as a new instance. */
export function placeMachine(roomId: string, machineId: MachineId): boolean {
  if (machineId === "hand") return false;
  let ok = false;
  store.update((s) => {
    if ((s.inventory[machineId] ?? 0) < 1) return;
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room) return;
    s.inventory[machineId] = s.inventory[machineId]! - 1;
    if (s.inventory[machineId]! <= 0) delete s.inventory[machineId];
    room.cells.push({
      kind: "machine",
      instanceId: newInstanceId("m"),
      machineId,
      output: {},
      jobId: null,
    });
    ok = true;
  });
  return ok;
}

/**
 * Take a specific placed machine instance back into inventory. Refuses if it
 * is currently running a job or has unclaimed output.
 */
export function pickupMachine(instanceId: string): boolean {
  let ok = false;
  store.update((s) => {
    for (const r of s.rooms) {
      const idx = r.cells.findIndex(
        (c) => c.kind === "machine" && c.instanceId === instanceId,
      );
      if (idx < 0) continue;
      const cell = r.cells[idx] as PlacedMachine;
      if (cell.jobId) return;
      if (Object.values(cell.output).some((q) => q > 0)) return;
      r.cells.splice(idx, 1);
      s.inventory[cell.machineId] = (s.inventory[cell.machineId] ?? 0) + 1;
      ok = true;
      return;
    }
  });
  return ok;
}

// ---- quests ----

export function questContext(state: GameState): import("../data/types").QuestContext {
  const completed = new Set(state.completedQuests);
  return {
    has: (item, qty = 1) => (state.inventory[item] ?? 0) >= qty,
    completed: (id) => completed.has(id),
  };
}

/** Mark any visible quest whose `done` predicate now holds. Mutates the draft. */
function evaluateQuests(draft: GameState): void {
  const ctx = questContext(draft);
  const already = new Set(draft.completedQuests);
  for (const q of ALL_QUESTS) {
    if (already.has(q.id)) continue;
    if (!q.visible(ctx)) continue;
    if (q.done(ctx)) draft.completedQuests.push(q.id);
  }
}

export function questsForDisplay(state: GameState): {
  active: typeof ALL_QUESTS;
  completed: typeof ALL_QUESTS;
} {
  const ctx = questContext(state);
  const completedSet = new Set(state.completedQuests);
  const active = ALL_QUESTS.filter((q) => !completedSet.has(q.id) && q.visible(ctx));
  const completed = ALL_QUESTS.filter((q) => completedSet.has(q.id));
  return { active, completed };
}

// ---- pinned recipes ----

export function isPinned(state: GameState, id: RecipeId): boolean {
  return state.pinnedRecipes.includes(id);
}

export function togglePin(id: RecipeId): void {
  if (!RECIPES[id]) return;
  store.update((s) => {
    const i = s.pinnedRecipes.indexOf(id);
    if (i >= 0) s.pinnedRecipes.splice(i, 1);
    else s.pinnedRecipes.push(id);
  });
}

// ---- chests ----

export function chestSlotCap(type: ItemId): number {
  return CHEST_SLOT_CAP[type] ?? 16;
}

export function chestSlotsUsed(chest: PlacedChest): number {
  return slotsUsedIn(chest.contents);
}

/** Place a chest item from inventory into the given room as a new instance. */
export function placeChest(roomId: string, chestType: ItemId): boolean {
  if (CHEST_SLOT_CAP[chestType] === undefined) return false;
  let ok = false;
  store.update((s) => {
    if ((s.inventory[chestType] ?? 0) < 1) return;
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room) return;
    s.inventory[chestType] = s.inventory[chestType]! - 1;
    if (s.inventory[chestType]! <= 0) delete s.inventory[chestType];
    room.cells.push({
      kind: "chest",
      instanceId: newInstanceId("c"),
      type: chestType,
      contents: {},
      perishables: {},
    });
    ok = true;
  });
  return ok;
}

/** Pick up a placed chest. Refuses if it still has contents. */
export function pickupChest(roomId: string, instanceId: string): boolean {
  let ok = false;
  store.update((s) => {
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const idx = room.cells.findIndex(
      (c) => c.kind === "chest" && c.instanceId === instanceId,
    );
    if (idx < 0) return;
    const chest = room.cells[idx] as PlacedChest;
    if (chestSlotsUsed(chest) > 0) return;
    room.cells.splice(idx, 1);
    s.inventory[chest.type] = (s.inventory[chest.type] ?? 0) + 1;
    ok = true;
  });
  return ok;
}

/** Move all of an item from inventory into a chest, capped by chest slot space. */
export function depositToChest(
  roomId: string,
  instanceId: string,
  itemId: ItemId,
): boolean {
  let ok = false;
  store.update((s) => {
    const found = findChestInstance(s, instanceId);
    if (!found || found.roomId !== roomId) return;
    const chest = found.cell;
    const have = s.inventory[itemId] ?? 0;
    if (have <= 0) return;
    const stack = stackSize(itemId);
    const cap = chestSlotCap(chest.type);
    const used = chestSlotsUsed(chest);
    const currentQty = chest.contents[itemId] ?? 0;
    const currentSlots = Math.ceil(currentQty / stack);
    const availableSlots = cap - (used - currentSlots);
    const maxQty = Math.max(0, availableSlots * stack);
    const move = Math.max(0, Math.min(have, maxQty - currentQty));
    if (move <= 0) return;
    chest.contents[itemId] = currentQty + move;
    s.inventory[itemId] = have - move;
    if (s.inventory[itemId]! <= 0) delete s.inventory[itemId];
    // Carry the freshness batches with the items so chests aren't a fridge,
    // but if the chest has a preservation factor (pottery vessels), stretch
    // each batch's remaining shelf life by that factor on the way in.
    const taken = consumePerishable(s, itemId, move);
    if (taken.length > 0) {
      const factor = chestPreserveFactor(chest.type);
      const adjusted = scaleBatchRemaining(taken, gameMinutes(s), factor);
      chest.perishables[itemId] = mergeBatches(
        chest.perishables[itemId] ?? [],
        adjusted,
      );
    }
    ok = true;
  });
  return ok;
}

/** Move all of an item from a chest back into inventory, capped by carry cap (overflow → floor). */
export function withdrawFromChest(
  roomId: string,
  instanceId: string,
  itemId: ItemId,
): boolean {
  let ok = false;
  store.update((s) => {
    const found = findChestInstance(s, instanceId);
    if (!found || found.roomId !== roomId) return;
    const have = found.cell.contents[itemId] ?? 0;
    if (have <= 0) return;
    delete found.cell.contents[itemId];
    const chestBatches = found.cell.perishables[itemId];
    delete found.cell.perishables[itemId];
    // add() pushes a fresh batch — for perishable items we drop that and
    // restore the original batches we just lifted out of the chest, so
    // freshness is preserved across the round trip. Preservation factor
    // gets reversed on the way out so a deposit-then-withdraw is neutral.
    add(s, itemId, have);
    if (chestBatches && chestBatches.length > 0) {
      const fresh = s.perishables[itemId];
      if (fresh && fresh.length > 0) fresh.pop();
      const factor = chestPreserveFactor(found.cell.type);
      const adjusted = scaleBatchRemaining(chestBatches, gameMinutes(s), 1 / factor);
      const remaining = s.perishables[itemId] ?? [];
      s.perishables[itemId] = mergeBatches(remaining, adjusted);
    }
    ok = true;
  });
  return ok;
}

// ---- save ----

const SAVE_KEY = "bootstrap-factory:save:v1";

export { SCHEMA_VERSION, SAVE_KEY };

export function load(): void {
  setLastTrashed(null);
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      pauseDriftMs = 0;
      lastSampledAt = Date.now();
      store.set(emptyState());
      return;
    }
    const rawParsed = JSON.parse(raw);
    // Restore the game clock to where it was at save time so machine job
    // timestamps stay valid and tab-closed time counts as paused.
    const savedGameClock =
      typeof rawParsed.__savedGameClock === "number" ? rawParsed.__savedGameClock : null;
    delete rawParsed.__savedGameClock;
    pauseDriftMs = savedGameClock !== null ? Math.max(0, Date.now() - savedGameClock) : 0;
    lastSampledAt = Date.now();
    const result = migrate(rawParsed, SCHEMA_VERSION);
    if (!result) {
      store.set(emptyState());
      return;
    }
    const parsed = result.state as GameState;
    if (result.migrated) {
      console.info(`[save] migrated v${result.fromVersion} -> v${result.toVersion}`);
    }
    // Defensive: ensure fields exist.
    if (!parsed.floor) parsed.floor = {};
    if (!Array.isArray(parsed.jobs)) parsed.jobs = [];
    if (!Array.isArray(parsed.rooms)) parsed.rooms = [];
    if (!Array.isArray(parsed.completedQuests)) parsed.completedQuests = [];
    if (!Array.isArray(parsed.pinnedRecipes)) parsed.pinnedRecipes = [];
    if (parsed.actionJob === undefined) parsed.actionJob = null;
    if (!parsed.nodeCharges || typeof parsed.nodeCharges !== "object") parsed.nodeCharges = {};
    if (!parsed.discoveredBiomes || typeof parsed.discoveredBiomes !== "object") {
      parsed.discoveredBiomes = { forest: true };
    }
    if (parsed.lastExploreMessage === undefined) parsed.lastExploreMessage = null;
    if (!parsed.everBuilt || typeof parsed.everBuilt !== "object") parsed.everBuilt = {};
    if (typeof parsed.dayLength !== "number" || parsed.dayLength <= 0) parsed.dayLength = DEFAULT_DAY_LENGTH;
    if (typeof parsed.timeBudget !== "number" || parsed.timeBudget < 0) parsed.timeBudget = DEFAULT_STARTING_BUDGET;
    if (typeof parsed.worldClock !== "number" || parsed.worldClock < 0) parsed.worldClock = 0;
    if (typeof parsed.dayNumber !== "number" || parsed.dayNumber < 1) parsed.dayNumber = 1;
    if (!parsed.perishables || typeof parsed.perishables !== "object") parsed.perishables = {};
    for (const id of Object.keys(parsed.perishables)) {
      const v = parsed.perishables[id];
      if (!Array.isArray(v) || v.length === 0) delete parsed.perishables[id];
    }
    if (typeof parsed.seasonIndex !== "number" || parsed.seasonIndex < 0) {
      parsed.seasonIndex = Math.floor((parsed.dayNumber - 1) / DAYS_PER_SEASON) % SEASONS.length;
    }
    parsed.timeBudget = Math.min(parsed.timeBudget, parsed.dayLength);
    parsed.worldClock = Math.min(parsed.worldClock, parsed.dayLength);
    for (const r of parsed.rooms) {
      if (!Array.isArray(r.cells)) r.cells = [];
      for (const c of r.cells) {
        if (c.kind !== "chest") continue;
        if (!c.perishables || typeof c.perishables !== "object") {
          c.perishables = {};
        }
        for (const id of Object.keys(c.perishables)) {
          const v = c.perishables[id];
          if (!Array.isArray(v) || v.length === 0) delete c.perishables[id];
        }
      }
    }
    evaluateQuests(parsed);
    store.set(parsed);
    // Resolve any jobs that finished while the tab was closed.
    tickJobs();
  } catch {
    store.set(emptyState());
  }
}

export function save(): void {
  try {
    const payload = { ...store.get(), __savedGameClock: gameNow() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // quota / disabled storage — silently ignore for now
  }
}

export function reset(): void {
  pauseDriftMs = 0;
  lastSampledAt = Date.now();
  setLastTrashed(null);
  store.set(emptyState());
  save();
}
