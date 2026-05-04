import { GATHER_ACTIONS } from "../data/gather";
import { ITEMS } from "../data/items";
import { ALL_QUESTS } from "../data/quests";
import { RECIPES } from "../data/recipes";
import type {
  GatherAction,
  GatherId,
  ItemId,
  MachineId,
  QuestId,
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
  jobs: MachineJob[];
  gatherJob: GatherJob | null;
  rooms: Room[];
  completedQuests: QuestId[];
  pinnedRecipes: RecipeId[];
}

const SCHEMA_VERSION = 5;

export const ROOM_BUILD_COST: Stack[] = [{ item: "board", qty: 25 }];
export const ROOM_BUILD_TOOL: ToolRequirement = { type: "shovel", minTier: 1 };

export function emptyState(): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    inventory: {},
    jobs: [],
    gatherJob: null,
    rooms: [{ id: "room-starter", name: "Workshop", machines: {} }],
    completedQuests: [],
    pinnedRecipes: [],
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
      jobs: [...this.state.jobs],
      gatherJob: this.state.gatherJob ? { ...this.state.gatherJob } : null,
      rooms: this.state.rooms.map((r) => ({ ...r, machines: { ...r.machines } })),
      completedQuests: [...this.state.completedQuests],
      pinnedRecipes: [...this.state.pinnedRecipes],
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

export function add(state: GameState, id: ItemId, qty: number): void {
  if (qty <= 0) return;
  state.inventory[id] = (state.inventory[id] ?? 0) + qty;
}

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
    if ((state.inventory[i.item] ?? 0) < i.qty) return false;
  }
  return true;
}

export function canCraft(state: GameState, recipe: Recipe): CraftResult {
  if (!meetsToolReq(state, recipe.tool)) return { ok: false, reason: "missing_tool" };
  for (const i of recipe.inputs) {
    if ((state.inventory[i.item] ?? 0) < i.qty) return { ok: false, reason: "missing_inputs" };
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
    if (!tryConsume(s, recipe.inputs)) {
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

// ---- rooms ----

let roomSeq = 0;
function newRoomId(): string {
  roomSeq += 1;
  return `room-${Date.now().toString(36)}-${roomSeq}`;
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
    if (!Array.isArray(parsed.jobs)) parsed.jobs = [];
    if (!Array.isArray(parsed.rooms)) parsed.rooms = [];
    if (!Array.isArray(parsed.completedQuests)) parsed.completedQuests = [];
    if (!Array.isArray(parsed.pinnedRecipes)) parsed.pinnedRecipes = [];
    if (parsed.gatherJob === undefined) parsed.gatherJob = null;
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
