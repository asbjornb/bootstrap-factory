import { BIOMES } from "../data/biomes";
import { GATHER_ACTIONS } from "../data/gather";
import { ITEMS, stackSize } from "../data/items";
import { MACHINES } from "../data/machines";
import { NODES } from "../data/nodes";
import { ALL_QUESTS } from "../data/quests";
import { RECIPES } from "../data/recipes";
import { WANDER_ACTIVE_TIME, WANDER_DURATION_MS, WANDER_OUTCOMES, type WanderOutcome } from "../data/wander";
import { DURATION_SCALE } from "./dev";
import { migrate } from "./migrations";
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
  PlacedChest,
  PlacedMachine,
  QuestId,
  Recipe,
  RecipeId,
  ResourceNode,
  Room,
  Stack,
  ToolRequirement,
} from "../data/types";

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
   * For each perishable item id currently held: the absolute game-minute
   * at which the entire stack spoils. Cleared when the stack hits zero.
   */
  perishables: Record<ItemId, number>;
  /** Index 0..3 for spring/summer/autumn/winter. Advances every `daysPerSeason` sleeps. */
  seasonIndex: number;
}

const SCHEMA_VERSION = 11;

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
};

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
            : { ...c, contents: { ...c.contents } },
        ),
      })),
      everBuilt: { ...this.state.everBuilt },
      completedQuests: [...this.state.completedQuests],
      pinnedRecipes: [...this.state.pinnedRecipes],
      perishables: { ...this.state.perishables },
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

/** Highest carry-gear bonus the player owns. Bonuses don't stack — just the best. */
export function bestCarryBonus(state: GameState): number {
  let best = 0;
  for (const id of Object.keys(state.inventory)) {
    const bonus = ITEMS[id]?.carryBonus;
    if (bonus !== undefined && bonus > best) best = bonus;
  }
  return best;
}

export function carryCap(state: GameState): number {
  return BASE_CARRY_SLOTS + bestCarryBonus(state);
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
  const had = currentQty + (state.floor[id] ?? 0);
  if (canAdd > 0) state.inventory[id] = currentQty + canAdd;
  const overflow = qty - canAdd;
  if (overflow > 0) state.floor[id] = (state.floor[id] ?? 0) + overflow;
  // Perishables: start a fresh spoilage timer when this item went from
  // nothing to something. Restocks into an existing pile inherit the
  // older timer (mixing fresh into stale doesn't refresh anything).
  const perish = ITEMS[id]?.spoilsAfter;
  if (perish && had <= 0) {
    state.perishables[id] = gameMinutes(state) + perish;
  }
}

/**
 * Advance spoilage to the current game time. Any perishable whose timer has
 * elapsed is destroyed (inventory + floor) and its name returned so the UI
 * can surface a toast.
 */
export function tickSpoilage(state: GameState): ItemId[] {
  const now = gameMinutes(state);
  const expired: ItemId[] = [];
  for (const [id, t] of Object.entries(state.perishables)) {
    const total = (state.inventory[id] ?? 0) + (state.floor[id] ?? 0);
    if (total <= 0) {
      delete state.perishables[id];
      continue;
    }
    if (t > now) continue;
    expired.push(id);
    delete state.perishables[id];
    delete state.inventory[id];
    delete state.floor[id];
  }
  return expired;
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
 * Lenient consume: pulls from inventory first, then from any chest in any room.
 * Used by recipe crafting so chests act as a shared pantry.
 */
function tryConsumeLenient(state: GameState, stacks: Stack[]): boolean {
  for (const s of stacks) {
    if (totalAvailable(state, s.item) < s.qty) return false;
  }
  for (const s of stacks) {
    let need = s.qty;
    const fromInv = Math.min(need, state.inventory[s.item] ?? 0);
    if (fromInv > 0) {
      state.inventory[s.item] = (state.inventory[s.item] ?? 0) - fromInv;
      if (state.inventory[s.item]! <= 0) delete state.inventory[s.item];
      need -= fromInv;
    }
    if (need <= 0) continue;
    for (const r of state.rooms) {
      for (const cell of r.cells) {
        if (need <= 0) break;
        if (cell.kind !== "chest") continue;
        const have = cell.contents[s.item] ?? 0;
        if (have <= 0) continue;
        const take = Math.min(have, need);
        cell.contents[s.item] = have - take;
        if (cell.contents[s.item]! <= 0) delete cell.contents[s.item];
        need -= take;
      }
      if (need <= 0) break;
    }
  }
  return true;
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

/**
 * True if every output of the recipe is a tool item the player already owns
 * (anywhere) at the same or higher tier. Hides redundant tool crafts.
 */
export function producesObsoleteTool(state: GameState, recipe: Recipe): boolean {
  if (recipe.outputs.length === 0) return false;
  for (const out of recipe.outputs) {
    const tool = ITEMS[out.item]?.tool;
    if (!tool) return false;
    if (ownedToolTier(state, tool.type) < tool.tier) return false;
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
  reason?: "missing_inputs" | "missing_tool" | "machine_busy";
}

export function hasInputsAndTool(state: GameState, recipe: Recipe): boolean {
  if (!meetsToolReq(state, recipe.tool)) return false;
  for (const i of recipe.inputs) {
    if (totalAvailable(state, i.item) < i.qty) return false;
  }
  return true;
}

export function canCraft(state: GameState, recipe: Recipe): CraftResult {
  if (!meetsToolReq(state, recipe.tool)) return { ok: false, reason: "missing_tool" };
  for (const i of recipe.inputs) {
    if (totalAvailable(state, i.item) < i.qty) return { ok: false, reason: "missing_inputs" };
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
function depositOutputsToInstance(cell: PlacedMachine, recipe: Recipe): void {
  for (const o of recipe.outputs) {
    cell.output[o.item] = (cell.output[o.item] ?? 0) + o.qty;
    if (MACHINES[o.item]) {
      // Tracked at the state level — handled in tickJobs / craftAt callers via applyRecipeOutputs.
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
      const now = Date.now();
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
    for (const i of recipe.inputs) {
      if (totalAvailable(s, i.item) < i.qty) {
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
      depositOutputsToInstance(found.cell, recipe);
      for (const o of recipe.outputs) {
        if (MACHINES[o.item]) s.everBuilt[o.item] = true;
      }
    } else {
      const now = Date.now();
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
  });
  return ok;
}

/** Complete any jobs whose endsAt has passed. Returns true if any changed. */
export function tickJobs(now: number = Date.now()): boolean {
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
          depositOutputsToInstance(found.cell, r);
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
    tickJobs();
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

/** In-world minutes a gather action takes. Falls back to baseDurationMs/1000. */
export function gatherActiveTime(action: GatherAction): number {
  return action.activeTime ?? Math.max(1, Math.round(action.baseDurationMs / 1000));
}

/** In-world minutes a harvest takes. */
export function nodeActiveTime(node: ResourceNode): number {
  return node.activeTime ?? Math.max(1, Math.round(node.baseDurationMs / 1000));
}

/** In-world minutes spent exploring a biome. */
export function biomeActiveTime(biome: Biome): number {
  return biome.activeTime ?? Math.max(1, Math.round(biome.exploreDurationMs / 1000));
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

/** True iff every provision stack is available across inventory + chests. */
export function hasProvisions(state: GameState, stacks: Stack[] | undefined): boolean {
  if (!stacks || stacks.length === 0) return true;
  for (const s of stacks) {
    if (totalAvailable(state, s.item) < s.qty) return false;
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
      const now = Date.now();
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
      const now = Date.now();
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
      const now = Date.now();
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
    const now = Date.now();
    s.actionJob = { kind: "wander", startedAt: now, endsAt: now + WANDER_DURATION_MS * DURATION_SCALE };
    result = { ok: true };
  });
  return result;
}

// ---- food / sleep ----

/** Eat one unit of a food item from inventory. Refunds time-budget, capped at dayLength. */
export function eat(itemId: ItemId): boolean {
  const item: Item | undefined = ITEMS[itemId];
  if (!item?.food) return false;
  let ok = false;
  store.update((s) => {
    if ((s.inventory[itemId] ?? 0) <= 0) return;
    s.inventory[itemId] = s.inventory[itemId]! - 1;
    if (s.inventory[itemId]! <= 0) delete s.inventory[itemId];
    s.timeBudget = Math.min(s.dayLength, s.timeBudget + item.food!.satiatesMinutes);
    ok = true;
  });
  return ok;
}

/**
 * Sleep until dawn. Resets the world clock, bumps the day, and fast-forwards
 * any in-flight machine jobs by the slept real-time gap so they look like
 * they ran while the player rested. Sleep itself costs no food.
 */
export function sleep(): boolean {
  let ok = false;
  store.update((s) => {
    if (s.actionJob) return;
    const sleptMinutes = s.dayLength - s.worldClock;
    if (sleptMinutes <= 0 && s.dayNumber !== 0) {
      // Already at end of day — still allow sleeping (rolls to next morning).
    }
    // Fast-forward machine job timestamps so they continue from the new dawn.
    // 1 in-world minute == 1 real second of action time, but background
    // machines are wall-clock based, so we just shift their endsAt back by
    // however much real time the slept duration represents at the same scale.
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
    ok = true;
  });
  if (ok) tickJobs();
  return ok;
}

function randInt(lo: number, hi: number): number {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

// ---- floor pile ----

/** Pick up everything from the floor that fits into inventory; leave the rest. */
export function pickUpAllFromFloor(): void {
  store.update((s) => {
    const snapshot = Object.entries(s.floor).filter(([, q]) => q > 0);
    s.floor = {};
    for (const [id, qty] of snapshot) add(s, id, qty);
  });
}

/** Pick up just one item type from the floor. */
export function pickUpFromFloor(id: ItemId): void {
  store.update((s) => {
    const qty = s.floor[id] ?? 0;
    if (qty <= 0) return;
    delete s.floor[id];
    add(s, id, qty);
  });
}

// ---- trash ----

/** Discard the entire stack of an item from inventory. */
export function trashFromInventory(id: ItemId): boolean {
  let ok = false;
  store.update((s) => {
    if ((s.inventory[id] ?? 0) <= 0) return;
    delete s.inventory[id];
    ok = true;
  });
  return ok;
}

/** Discard the entire stack of an item from the floor pile. */
export function trashFromFloor(id: ItemId): boolean {
  let ok = false;
  store.update((s) => {
    if ((s.floor[id] ?? 0) <= 0) return;
    delete s.floor[id];
    ok = true;
  });
  return ok;
}

/** Discard the entire stack of an item from a placed chest. */
export function trashFromChest(roomId: string, instanceId: string, id: ItemId): boolean {
  let ok = false;
  store.update((s) => {
    const found = findChestInstance(s, instanceId);
    if (!found || found.roomId !== roomId) return;
    if ((found.cell.contents[id] ?? 0) <= 0) return;
    delete found.cell.contents[id];
    ok = true;
  });
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
    add(s, itemId, have);
    ok = true;
  });
  return ok;
}

// ---- save ----

const SAVE_KEY = "bootstrap-factory:save:v1";

export { SCHEMA_VERSION, SAVE_KEY };

export function load(): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      store.set(emptyState());
      return;
    }
    const result = migrate(JSON.parse(raw), SCHEMA_VERSION);
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
    if (typeof parsed.seasonIndex !== "number" || parsed.seasonIndex < 0) {
      parsed.seasonIndex = Math.floor((parsed.dayNumber - 1) / DAYS_PER_SEASON) % SEASONS.length;
    }
    parsed.timeBudget = Math.min(parsed.timeBudget, parsed.dayLength);
    parsed.worldClock = Math.min(parsed.worldClock, parsed.dayLength);
    for (const r of parsed.rooms) {
      if (!Array.isArray(r.cells)) r.cells = [];
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
    localStorage.setItem(SAVE_KEY, JSON.stringify(store.get()));
  } catch {
    // quota / disabled storage — silently ignore for now
  }
}

export function reset(): void {
  store.set(emptyState());
  save();
}
