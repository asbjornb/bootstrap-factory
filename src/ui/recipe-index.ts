import { BIOMES } from "../data/biomes";
import { gatherActionsProducing } from "../data/gather";
import { ALL_ITEMS, ITEMS } from "../data/items";
import { MACHINES } from "../data/machines";
import { nodesProducing } from "../data/nodes";
import {
  recipesConsuming,
  recipesProducing,
  recipesUsingAsTool,
} from "../data/recipes";
import { isPinned, store, togglePin } from "../game/state";
import type { DropEntry, GatherAction, ItemId, Recipe, ResourceNode } from "../data/types";
import { clear, el } from "./dom";

interface IndexState {
  query: string;
  selected: ItemId | null;
  history: ItemId[]; // back-stack
}

const state: IndexState = { query: "", selected: null, history: [] };
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function selectItem(id: ItemId): void {
  if (state.selected && state.selected !== id) state.history.push(state.selected);
  state.selected = id;
  notify();
}

function back(): void {
  const prev = state.history.pop();
  if (prev) {
    state.selected = prev;
    notify();
  }
}

function setQuery(q: string): void {
  state.query = q;
  notify();
}

export function mountRecipeIndex(root: HTMLElement): void {
  const render = () => {
    clear(root);
    root.appendChild(
      el("div", { class: "recipe-index" }, [
        el("input", {
          class: "search",
          type: "search",
          placeholder: "Search items…",
          value: state.query,
          oninput: (ev: Event) => setQuery((ev.target as HTMLInputElement).value),
        }),
        el("div", { class: "ri-body" }, [renderItemList(), renderDetail()]),
      ]),
    );
  };
  render();
  listeners.add(render);
  // Re-render on inventory changes too — affects the "you have N" indicator.
  store.subscribe(render);
}

function renderItemList(): HTMLElement {
  const q = state.query.trim().toLowerCase();
  const items = ALL_ITEMS.filter(
    (i) =>
      !q ||
      i.name.toLowerCase().includes(q) ||
      i.id.includes(q) ||
      (i.description ?? "").toLowerCase().includes(q),
  );
  return el(
    "ul",
    { class: "ri-item-list" },
    items.length === 0
      ? [el("li", { class: "muted small" }, "No matches.")]
      : items.map((i) => {
          const owned = store.get().inventory[i.id] ?? 0;
          return el(
            "li",
            {
              class: "ri-item" + (state.selected === i.id ? " selected" : ""),
              onclick: () => selectItem(i.id),
            },
            [
              el("span", { class: "icon" }, i.icon),
              el("span", { class: "name" }, i.name),
              owned > 0 ? el("span", { class: "qty" }, String(owned)) : null,
            ],
          );
        }),
  );
}

function renderDetail(): HTMLElement {
  if (!state.selected) {
    return el(
      "div",
      { class: "ri-detail empty muted" },
      "Pick an item on the left to see its recipes, what it's used for, and (if it's a tool) what it unlocks.",
    );
  }
  const id = state.selected;
  const it = ITEMS[id]!;
  const produced = recipesProducing(id);
  const consumed = recipesConsuming(id);
  const asTool = recipesUsingAsTool(id);
  const gatheredFrom = gatherActionsProducing(id);
  const harvestedFrom = nodesProducing(id);
  const owned = store.get().inventory[id] ?? 0;

  return el("div", { class: "ri-detail" }, [
    el("div", { class: "ri-detail-head" }, [
      state.history.length > 0
        ? el("button", { class: "back-btn", onclick: back, title: "Back" }, "←")
        : null,
      el("span", { class: "icon huge" }, it.icon),
      el("div", {}, [
        el("h3", {}, it.name),
        el("p", { class: "muted small" }, it.description ?? ""),
        el("p", { class: "small" }, `In inventory: ${owned}`),
        it.tool
          ? el(
              "p",
              { class: "small tag" },
              `Tool: ${it.tool.type} (tier ${it.tool.tier})`,
            )
          : null,
      ]),
    ]),
    gatheredFrom.length > 0
      ? gatherSection(`Gathered from (${gatheredFrom.length})`, gatheredFrom, id)
      : null,
    harvestedFrom.length > 0
      ? nodeSection(`Harvested from (${harvestedFrom.length})`, harvestedFrom, id)
      : null,
    section(`Recipes (${produced.length})`, produced, id, "produces"),
    section(`Used in (${consumed.length})`, consumed, id, "consumes"),
    asTool.length > 0
      ? section(`Used as tool in (${asTool.length})`, asTool, id, "tool")
      : null,
  ]);
}

function section(
  title: string,
  recipes: Recipe[],
  focusItem: ItemId,
  mode: "produces" | "consumes" | "tool",
): HTMLElement {
  return el("div", { class: "ri-section" }, [
    el("h4", {}, title),
    recipes.length === 0
      ? el("p", { class: "muted small" }, "—")
      : el("div", { class: "recipe-list" }, recipes.map((r) => renderRecipeCard(r, focusItem, mode))),
  ]);
}

function renderRecipeCard(r: Recipe, focus: ItemId, mode: "produces" | "consumes" | "tool"): HTMLElement {
  const m = MACHINES[r.machine]!;
  const pinned = isPinned(store.get(), r.id);
  return el("div", { class: "ri-recipe" }, [
    el("div", { class: "ri-recipe-machine", title: m.name }, [
      el("span", { class: "icon" }, m.icon),
      el("span", { class: "small" }, m.name),
    ]),
    el(
      "div",
      { class: "ri-recipe-stacks" },
      [
        ...r.inputs.map((s) => stackChip(s.item, s.qty, s.item === focus && mode === "consumes")),
        el("span", { class: "arrow" }, "→"),
        ...r.outputs.map((s) => stackChip(s.item, s.qty, s.item === focus && mode === "produces")),
      ],
    ),
    el(
      "button",
      {
        class: "pin-btn" + (pinned ? " pinned" : ""),
        title: pinned ? "Unpin from Craft panel" : "Pin to Craft panel",
        "aria-pressed": pinned ? "true" : "false",
        onclick: (ev: Event) => {
          ev.stopPropagation();
          togglePin(r.id);
        },
      },
      pinned ? "📌" : "📍",
    ),
    r.tool
      ? el(
          "div",
          { class: "ri-recipe-tool" + (mode === "tool" ? " focus" : "") },
          `Requires ${r.tool.type} (tier ≥ ${r.tool.minTier})`,
        )
      : null,
  ]);
}

function gatherSection(
  title: string,
  actions: GatherAction[],
  focusItem: ItemId,
): HTMLElement {
  return el("div", { class: "ri-section" }, [
    el("h4", {}, title),
    el(
      "div",
      { class: "recipe-list" },
      actions.map((a) => renderGatherCard(a, focusItem)),
    ),
  ]);
}

function renderGatherCard(a: GatherAction, focus: ItemId): HTMLElement {
  const drops = a.drops.filter((d) => d.item === focus);
  return el("div", { class: "ri-recipe" }, [
    el("div", { class: "ri-recipe-machine", title: a.name }, [
      el("span", { class: "icon" }, a.icon),
      el("span", { class: "small" }, a.name),
    ]),
    el(
      "div",
      { class: "ri-recipe-stacks" },
      drops.map((d) => dropChip(d)),
    ),
  ]);
}

function nodeSection(
  title: string,
  nodes: ResourceNode[],
  focusItem: ItemId,
): HTMLElement {
  return el("div", { class: "ri-section" }, [
    el("h4", {}, title),
    el(
      "div",
      { class: "recipe-list" },
      nodes.map((n) => renderNodeCard(n, focusItem)),
    ),
  ]);
}

function renderNodeCard(n: ResourceNode, focus: ItemId): HTMLElement {
  const drops = n.drops.filter((d) => d.item === focus);
  const biome = BIOMES[n.biome];
  const sub = biome ? `Found by exploring ${biome.name}` : "";
  return el("div", { class: "ri-recipe" }, [
    el("div", { class: "ri-recipe-machine", title: n.name }, [
      el("span", { class: "icon" }, n.icon),
      el("span", { class: "small" }, n.name),
    ]),
    el(
      "div",
      { class: "ri-recipe-stacks" },
      drops.map((d) => dropChip(d)),
    ),
    n.requiresTool || sub
      ? el(
          "div",
          { class: "ri-recipe-tool" },
          [
            sub,
            n.requiresTool
              ? `${sub ? " · " : ""}requires ${n.requiresTool.type} (tier ≥ ${n.requiresTool.minTier})`
              : "",
          ].join(""),
        )
      : null,
  ]);
}

function dropChip(d: DropEntry): HTMLElement {
  const it = ITEMS[d.item]!;
  const qty = d.qty[0] === d.qty[1] ? `${d.qty[0]}` : `${d.qty[0]}–${d.qty[1]}`;
  const pct = `${Math.round(d.chance * 100)}%`;
  const tool = d.requiresTool
    ? ` · needs ${d.requiresTool.type} ≥ ${d.requiresTool.minTier}`
    : "";
  const machine = d.requiresMachineEverBuilt
    ? ` · after building ${MACHINES[d.requiresMachineEverBuilt]?.name ?? d.requiresMachineEverBuilt}`
    : "";
  return el(
    "button",
    {
      class: "stack-chip focus",
      title: `${it.name} — open`,
      onclick: () => selectItem(d.item),
    },
    [
      el("span", { class: "icon" }, it.icon),
      el("span", {}, ` ${qty} ${it.name} (${pct}${tool}${machine})`),
    ],
  );
}

function stackChip(id: ItemId, qty: number, focused: boolean): HTMLElement {
  const it = ITEMS[id]!;
  return el(
    "button",
    {
      class: "stack-chip" + (focused ? " focus" : ""),
      title: `${it.name} — open`,
      onclick: () => selectItem(id),
    },
    [el("span", { class: "icon" }, it.icon), el("span", {}, ` ${qty} ${it.name}`)],
  );
}
