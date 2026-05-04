import { GATHER_ACTIONS } from "../data/gather";
import { ITEMS, stackSize } from "../data/items";
import { RECIPES } from "../data/recipes";
import type {
  Chest,
  GatherAction,
  GatherId,
  ItemId,
  MachineId,
  Recipe,
  RecipeId,
  Room,
  Stack,
  ToolRequirement,
} from "../data/types";

export interface MachineJob {
  id: string;
  machineId: MachineId;
  recipeId: RecipeId;
  startedAt: number;
  endsAt: number;
}

export interface GatherJob {
  gatherId: GatherId;
  startedAt: number;
  endsAt: number;
}

export interface GameState {
  schemaVersion: number;
  inventory: Record<ItemId, number>;
  /** Items that overflowed when the player's inventory was full. Workshop floor pile. */
  floor: Record<ItemId, number>;
  jobs: MachineJob[];
  gatherJob: GatherJob | null;
  rooms: Room[];
}

const SCHEMA_VERSION = 5;

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
    gatherJob: null,
    rooms: [{ id: "room-starter", name: "Workshop", machines: {}, chests: [] }],
  };
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
      gatherJob: this.state.gatherJob ? { ...this.state.gatherJob } : null,
      rooms: this.state.rooms.map((r) => ({
        ...r,
        machines: { ...r.machines },
        chests: r.chests.map((c) => ({ ...c, contents: { ...c.contents } })),
      })),
    };
    fn(draft);
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
  if (canAdd > 0) state.inventory[id] = currentQty + canAdd;
  const overflow = qty - canAdd;
  if (overflow > 0) state.floor[id] = (state.floor[id] ?? 0) + overflow;
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
    for (const c of r.chests) total += c.contents[id] ?? 0;
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
      for (const c of r.chests) {
        if (need <= 0) break;
        const have = c.contents[s.item] ?? 0;
        if (have <= 0) continue;
        const take = Math.min(have, need);
        c.contents[s.item] = have - take;
        if (c.contents[s.item]! <= 0) delete c.contents[s.item];
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

// ---- machine capacity ----

/** Total of a given machine type placed across all rooms. */
export function placedMachineCount(state: GameState, machineId: MachineId): number {
  let n = 0;
  for (const r of state.rooms) n += r.machines[machineId] ?? 0;
  return n;
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
  return machineCapacity(state, machineId) - activeJobsFor(state, machineId).length;
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

export function craft(recipeId: RecipeId): CraftResult {
  const recipe = RECIPES[recipeId];
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);
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
      for (const o of recipe.outputs) add(s, o.item, o.qty);
    } else {
      const now = Date.now();
      s.jobs.push({
        id: newJobId(),
        machineId: recipe.machine,
        recipeId: recipe.id,
        startedAt: now,
        endsAt: now + dur,
      });
    }
    result = { ok: true };
  });
  return result;
}

/** Complete any jobs whose endsAt has passed. Returns true if any changed. */
export function tickJobs(now: number = Date.now()): boolean {
  const s = store.get();
  const machineDue = s.jobs.some((j) => j.endsAt <= now);
  const gatherDue = s.gatherJob !== null && s.gatherJob.endsAt <= now;
  if (!machineDue && !gatherDue) return false;
  store.update((draft) => {
    const remaining: MachineJob[] = [];
    for (const j of draft.jobs) {
      if (j.endsAt <= now) {
        const r = RECIPES[j.recipeId];
        if (r) for (const o of r.outputs) add(draft, o.item, o.qty);
      } else {
        remaining.push(j);
      }
    }
    draft.jobs = remaining;
    if (draft.gatherJob && draft.gatherJob.endsAt <= now) {
      const action = GATHER_ACTIONS[draft.gatherJob.gatherId];
      if (action) applyGatherDrops(draft, action);
      draft.gatherJob = null;
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

/** Duration of a gather action given the player's current tools. */
export function gatherDuration(state: GameState, action: GatherAction): number {
  let best = action.baseDurationMs;
  for (const sp of action.speedups ?? []) {
    if (bestToolTier(state, sp.type) >= sp.minTier && sp.durationMs < best) {
      best = sp.durationMs;
    }
  }
  return best;
}

function applyGatherDrops(state: GameState, action: GatherAction): void {
  const got: Record<ItemId, number> = {};
  for (const drop of action.drops) {
    if (!meetsToolReq(state, drop.requiresTool)) continue;
    if (Math.random() > drop.chance) continue;
    const qty = randInt(drop.qty[0], drop.qty[1]);
    got[drop.item] = (got[drop.item] ?? 0) + qty;
  }
  for (const [item, qty] of Object.entries(got)) add(state, item, qty);
}

export interface GatherResult {
  ok: boolean;
  reason?: "busy" | "unknown";
}

export function gather(actionId: GatherId): GatherResult {
  const action = GATHER_ACTIONS[actionId];
  if (!action) return { ok: false, reason: "unknown" };
  let result: GatherResult = { ok: false };
  store.update((s) => {
    if (s.gatherJob) {
      result = { ok: false, reason: "busy" };
      return;
    }
    const dur = gatherDuration(s, action);
    if (dur <= 0) {
      applyGatherDrops(s, action);
    } else {
      const now = Date.now();
      s.gatherJob = { gatherId: action.id, startedAt: now, endsAt: now + dur };
    }
    result = { ok: true };
  });
  return result;
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

// ---- rooms ----

let roomSeq = 0;
function newRoomId(): string {
  roomSeq += 1;
  return `room-${Date.now().toString(36)}-${roomSeq}`;
}

let chestSeq = 0;
function newChestId(): string {
  chestSeq += 1;
  return `chest-${Date.now().toString(36)}-${chestSeq}`;
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
      machines: {},
      chests: [],
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

/** Move a machine from inventory into the given room. */
export function placeMachine(roomId: string, machineId: MachineId): boolean {
  if (machineId === "hand") return false;
  let ok = false;
  store.update((s) => {
    if ((s.inventory[machineId] ?? 0) < 1) return;
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room) return;
    s.inventory[machineId] = s.inventory[machineId]! - 1;
    if (s.inventory[machineId]! <= 0) delete s.inventory[machineId];
    room.machines[machineId] = (room.machines[machineId] ?? 0) + 1;
    ok = true;
  });
  return ok;
}

/** Take a machine back out of a room into inventory. Refuses if it would interrupt a running job. */
export function pickupMachine(roomId: string, machineId: MachineId): boolean {
  if (machineId === "hand") return false;
  let ok = false;
  store.update((s) => {
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room) return;
    if ((room.machines[machineId] ?? 0) < 1) return;
    const totalPlaced = placedMachineCount(s, machineId);
    const busy = activeJobsFor(s, machineId).length;
    if (totalPlaced - busy < 1) return;
    room.machines[machineId] = room.machines[machineId]! - 1;
    if (room.machines[machineId]! <= 0) delete room.machines[machineId];
    s.inventory[machineId] = (s.inventory[machineId] ?? 0) + 1;
    ok = true;
  });
  return ok;
}

// ---- chests ----

export function chestSlotCap(type: ItemId): number {
  return CHEST_SLOT_CAP[type] ?? 16;
}

export function chestSlotsUsed(chest: Chest): number {
  return slotsUsedIn(chest.contents);
}

/** Place a chest item from inventory into the given room. */
export function placeChest(roomId: string, chestType: ItemId): boolean {
  if (CHEST_SLOT_CAP[chestType] === undefined) return false;
  let ok = false;
  store.update((s) => {
    if ((s.inventory[chestType] ?? 0) < 1) return;
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room) return;
    s.inventory[chestType] = s.inventory[chestType]! - 1;
    if (s.inventory[chestType]! <= 0) delete s.inventory[chestType];
    room.chests.push({ id: newChestId(), type: chestType, contents: {} });
    ok = true;
  });
  return ok;
}

/** Pick up a placed chest. Refuses if it still has contents. */
export function pickupChest(roomId: string, chestId: string): boolean {
  let ok = false;
  store.update((s) => {
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const idx = room.chests.findIndex((c) => c.id === chestId);
    if (idx < 0) return;
    const chest = room.chests[idx]!;
    if (chestSlotsUsed(chest) > 0) return;
    room.chests.splice(idx, 1);
    s.inventory[chest.type] = (s.inventory[chest.type] ?? 0) + 1;
    ok = true;
  });
  return ok;
}

/** Move all of an item from inventory into a chest, capped by chest slot space. */
export function depositToChest(roomId: string, chestId: string, itemId: ItemId): boolean {
  let ok = false;
  store.update((s) => {
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const chest = room.chests.find((c) => c.id === chestId);
    if (!chest) return;
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
export function withdrawFromChest(roomId: string, chestId: string, itemId: ItemId): boolean {
  let ok = false;
  store.update((s) => {
    const room = s.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const chest = room.chests.find((c) => c.id === chestId);
    if (!chest) return;
    const have = chest.contents[itemId] ?? 0;
    if (have <= 0) return;
    delete chest.contents[itemId];
    add(s, itemId, have);
    ok = true;
  });
  return ok;
}

// ---- save ----

const SAVE_KEY = "bootstrap-factory:save:v1";

export function load(): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      store.set(emptyState());
      return;
    }
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      store.set(emptyState());
      return;
    }
    // Defensive: ensure fields exist.
    if (!parsed.floor) parsed.floor = {};
    if (!Array.isArray(parsed.jobs)) parsed.jobs = [];
    if (!Array.isArray(parsed.rooms)) parsed.rooms = [];
    if (parsed.gatherJob === undefined) parsed.gatherJob = null;
    for (const r of parsed.rooms) {
      if (!Array.isArray(r.chests)) r.chests = [];
    }
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
