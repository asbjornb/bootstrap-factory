import { GATHER_ACTIONS } from "../data/gather";
import { ITEMS } from "../data/items";
import { RECIPES } from "../data/recipes";
import type {
  GatherId,
  ItemId,
  Recipe,
  RecipeId,
  Stack,
  ToolRequirement,
} from "../data/types";

export interface GameState {
  schemaVersion: number;
  inventory: Record<ItemId, number>;
}

const SCHEMA_VERSION = 2;

export function emptyState(): GameState {
  return { schemaVersion: SCHEMA_VERSION, inventory: {} };
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
    // Cheap shallow clone of mutable fields. The state shape is small enough that
    // copying is fine and lets us notify on every change.
    const draft: GameState = {
      ...this.state,
      inventory: { ...this.state.inventory },
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

// ---- recipe / gather actions ----

export interface CraftResult {
  ok: boolean;
  reason?: "missing_inputs" | "missing_tool";
}

export function canCraft(state: GameState, recipe: Recipe): CraftResult {
  if (!meetsToolReq(state, recipe.tool)) return { ok: false, reason: "missing_tool" };
  for (const i of recipe.inputs) {
    if ((state.inventory[i.item] ?? 0) < i.qty) return { ok: false, reason: "missing_inputs" };
  }
  return { ok: true };
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
    for (const o of recipe.outputs) add(s, o.item, o.qty);
    result = { ok: true };
  });
  return result;
}

export function gather(actionId: GatherId): void {
  const action = GATHER_ACTIONS[actionId];
  if (!action) throw new Error(`Unknown gather action: ${actionId}`);
  store.update((s) => {
    const got: Record<ItemId, number> = {};
    for (const drop of action.drops) {
      if (!meetsToolReq(s, drop.requiresTool)) continue;
      if (Math.random() > drop.chance) continue;
      const qty = randInt(drop.qty[0], drop.qty[1]);
      got[drop.item] = (got[drop.item] ?? 0) + qty;
    }
    for (const [item, qty] of Object.entries(got)) add(s, item, qty);
  });
}

function randInt(lo: number, hi: number): number {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
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
    store.set(parsed);
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
