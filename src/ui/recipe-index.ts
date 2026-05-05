import { BIOMES } from "../data/biomes";
import { gatherActionsProducing } from "../data/gather";
import { ALL_ITEMS, ITEMS, itemsWithTag } from "../data/items";
import { MACHINES } from "../data/machines";
import { nodesProducing } from "../data/nodes";
import {
  recipesConsuming,
  recipesProducing,
  recipesUsingAsMachine,
  recipesUsingAsTool,
} from "../data/recipes";
import { isPinned, SEASONS, store, togglePin } from "../game/state";
import { isTagInput } from "../data/types";
import type { DropEntry, GatherAction, ItemId, Recipe, RecipeInput, ResourceNode } from "../data/types";
import { clear, el } from "./dom";

type Selection =
  | { kind: "item"; id: ItemId }
  | { kind: "tag"; tag: string };

interface IndexState {
  query: string;
  selected: Selection | null;
  history: Selection[]; // back-stack
}

const state: IndexState = { query: "", selected: null, history: [] };
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function sameSelection(a: Selection, b: Selection): boolean {
  if (a.kind === "item" && b.kind === "item") return a.id === b.id;
  if (a.kind === "tag" && b.kind === "tag") return a.tag === b.tag;
  return false;
}

function select(next: Selection): void {
  if (state.selected && !sameSelection(state.selected, next)) {
    state.history.push(state.selected);
  }
  state.selected = next;
  notify();
}

export function selectItem(id: ItemId): void {
  select({ kind: "item", id });
}

export function selectTag(tag: string): void {
  select({ kind: "tag", tag });
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
  clear(root);
  const search = el("input", {
    class: "search",
    type: "search",
    placeholder: "Search items…",
    value: state.query,
    oninput: (ev: Event) => setQuery((ev.target as HTMLInputElement).value),
  }) as HTMLInputElement;
  const body = el("div", { class: "ri-body" });
  root.appendChild(el("div", { class: "recipe-index" }, [search, body]));

  const renderBody = () => {
    if (search.value !== state.query) search.value = state.query;
    clear(body);
    body.appendChild(renderItemList());
    body.appendChild(renderDetail());
  };
  renderBody();
  listeners.add(renderBody);
  // Re-render on inventory changes too — affects the "you have N" indicator.
  store.subscribe(renderBody);
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
          const isSelected =
            state.selected?.kind === "item" && state.selected.id === i.id;
          return el(
            "li",
            {
              class: "ri-item" + (isSelected ? " selected" : ""),
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
  if (state.selected.kind === "tag") return renderTagDetail(state.selected.tag);
  return renderItemDetail(state.selected.id);
}

function renderItemDetail(id: ItemId): HTMLElement {
  const it = ITEMS[id]!;
  const produced = recipesProducing(id);
  const consumed = recipesConsuming(id);
  const asTool = recipesUsingAsTool(id);
  const asMachine = MACHINES[id] ? recipesUsingAsMachine(id) : [];
  const gatheredFrom = gatherActionsProducing(id);
  const harvestedFrom = nodesProducing(id);
  const owned = store.get().inventory[id] ?? 0;
  const focus: Focus = { kind: "item", id };

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
    section(`Recipes (${produced.length})`, produced, focus, "produces"),
    section(`Used in (${consumed.length})`, consumed, focus, "consumes"),
    asTool.length > 0
      ? section(`Used as tool in (${asTool.length})`, asTool, focus, "tool")
      : null,
    asMachine.length > 0
      ? section(`Crafted at this (${asMachine.length})`, asMachine, focus, "machine")
      : null,
  ]);
}

function renderTagDetail(tag: string): HTMLElement {
  const matches = itemsWithTag(tag);
  const focus: Focus = { kind: "tag", tag };

  const producedSeen = new Set<string>();
  const produced: Recipe[] = [];
  const gatheredSeen = new Set<string>();
  const gathered: GatherAction[] = [];
  const harvestedSeen = new Set<string>();
  const harvested: ResourceNode[] = [];
  for (const it of matches) {
    for (const r of recipesProducing(it.id)) {
      if (!producedSeen.has(r.id)) {
        producedSeen.add(r.id);
        produced.push(r);
      }
    }
    for (const a of gatherActionsProducing(it.id)) {
      if (!gatheredSeen.has(a.id)) {
        gatheredSeen.add(a.id);
        gathered.push(a);
      }
    }
    for (const n of nodesProducing(it.id)) {
      if (!harvestedSeen.has(n.id)) {
        harvestedSeen.add(n.id);
        harvested.push(n);
      }
    }
  }
  // Recipes consuming the tag: any recipe with a TagInput for this tag,
  // or a literal item input that carries this tag. Use the first matching
  // item to query (recipesConsuming already follows tag inputs), and merge.
  const consumedSeen = new Set<string>();
  const consumed: Recipe[] = [];
  for (const it of matches) {
    for (const r of recipesConsuming(it.id)) {
      if (!consumedSeen.has(r.id)) {
        consumedSeen.add(r.id);
        consumed.push(r);
      }
    }
  }

  const head = el("div", { class: "ri-detail-head" }, [
    state.history.length > 0
      ? el("button", { class: "back-btn", onclick: back, title: "Back" }, "←")
      : null,
    el("span", { class: "icon huge" }, matches[0]?.icon ?? "🏷️"),
    el("div", {}, [
      el("h3", {}, `Any ${tag}`),
      el(
        "p",
        { class: "muted small" },
        `A recipe asks for any item with the "${tag}" tag. Any of these will satisfy it:`,
      ),
      el(
        "div",
        { class: "ri-tag-members" },
        matches.length === 0
          ? [el("span", { class: "muted small" }, "No items carry this tag.")]
          : matches.map((m) => stackChip(m.id, 0, false, { hideQty: true })),
      ),
    ]),
  ]);

  return el("div", { class: "ri-detail" }, [
    head,
    gathered.length > 0
      ? gatherSection(
          `Gathered from (${gathered.length})`,
          gathered,
          (drop) => matches.some((m) => m.id === drop),
        )
      : null,
    harvested.length > 0
      ? nodeSection(
          `Harvested from (${harvested.length})`,
          harvested,
          (drop) => matches.some((m) => m.id === drop),
        )
      : null,
    section(`Recipes producing any ${tag} (${produced.length})`, produced, focus, "produces"),
    section(`Used in (${consumed.length})`, consumed, focus, "consumes"),
  ]);
}

type Focus =
  | { kind: "item"; id: ItemId }
  | { kind: "tag"; tag: string };

type RecipeMode = "produces" | "consumes" | "tool" | "machine";

function focusMatchesItem(focus: Focus, id: ItemId): boolean {
  if (focus.kind === "item") return focus.id === id;
  return ITEMS[id]?.tags?.includes(focus.tag) ?? false;
}

function focusMatchesTag(focus: Focus, tag: string): boolean {
  if (focus.kind === "tag") return focus.tag === tag;
  return ITEMS[focus.id]?.tags?.includes(tag) ?? false;
}

function section(
  title: string,
  recipes: Recipe[],
  focus: Focus,
  mode: RecipeMode,
): HTMLElement {
  return el("div", { class: "ri-section" }, [
    el("h4", {}, title),
    recipes.length === 0
      ? el("p", { class: "muted small" }, "—")
      : el("div", { class: "recipe-list" }, recipes.map((r) => renderRecipeCard(r, focus, mode))),
  ]);
}

function renderRecipeCard(r: Recipe, focus: Focus, mode: RecipeMode): HTMLElement {
  const m = MACHINES[r.machine]!;
  const pinned = isPinned(store.get(), r.id);
  const machineFocused = mode === "machine" && focus.kind === "item" && r.machine === focus.id;
  return el("div", { class: "ri-recipe" }, [
    el("div", { class: "ri-recipe-machine" + (machineFocused ? " focus" : ""), title: m.name }, [
      el("span", { class: "icon" }, m.icon),
      el("span", { class: "small" }, m.name),
    ]),
    el(
      "div",
      { class: "ri-recipe-stacks" },
      [
        ...r.inputs.map((i) => inputChip(i, focus, mode)),
        el("span", { class: "arrow" }, "→"),
        ...r.outputs.map((s) =>
          stackChip(s.item, s.qty, mode === "produces" && focusMatchesItem(focus, s.item)),
        ),
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

type DropMatcher = ItemId | ((drop: ItemId) => boolean);

function dropPredicate(m: DropMatcher): (drop: ItemId) => boolean {
  return typeof m === "function" ? m : (d) => d === m;
}

function gatherSection(
  title: string,
  actions: GatherAction[],
  match: DropMatcher,
): HTMLElement {
  const pred = dropPredicate(match);
  return el("div", { class: "ri-section" }, [
    el("h4", {}, title),
    el(
      "div",
      { class: "recipe-list" },
      actions.map((a) => renderGatherCard(a, pred)),
    ),
  ]);
}

function renderGatherCard(a: GatherAction, pred: (drop: ItemId) => boolean): HTMLElement {
  const drops = a.drops.filter((d) => pred(d.item));
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
  match: DropMatcher,
): HTMLElement {
  const pred = dropPredicate(match);
  return el("div", { class: "ri-section" }, [
    el("h4", {}, title),
    el(
      "div",
      { class: "recipe-list" },
      nodes.map((n) => renderNodeCard(n, pred)),
    ),
  ]);
}

function renderNodeCard(n: ResourceNode, pred: (drop: ItemId) => boolean): HTMLElement {
  const drops = n.drops.filter((d) => pred(d.item));
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
  const season = d.seasons && d.seasons.length < 4
    ? ` · ${d.seasons.map((i) => SEASONS[i]).join("/")}`
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
      el("span", {}, ` ${qty} ${it.name} (${pct}${tool}${machine}${season})`),
    ],
  );
}

function inputChip(
  i: RecipeInput,
  focus: Focus,
  mode: RecipeMode,
): HTMLElement {
  if (isTagInput(i)) {
    const matches = itemsWithTag(i.tag);
    const first = matches[0];
    const focused = mode === "consumes" && focusMatchesTag(focus, i.tag);
    const detail = matches.map((m) => m.name).join(", ");
    return el(
      "button",
      {
        class: "stack-chip tag-chip" + (focused ? " focus" : ""),
        title: `Any ${i.tag} — ${detail}`,
        onclick: () => selectTag(i.tag),
      },
      [
        el("span", { class: "icon" }, first?.icon ?? "•"),
        el("span", {}, ` ${i.qty} any ${i.tag}`),
      ],
    );
  }
  return stackChip(i.item, i.qty, mode === "consumes" && focusMatchesItem(focus, i.item));
}

function stackChip(
  id: ItemId,
  qty: number,
  focused: boolean,
  opts: { hideQty?: boolean } = {},
): HTMLElement {
  const it = ITEMS[id]!;
  return el(
    "button",
    {
      class: "stack-chip" + (focused ? " focus" : ""),
      title: `${it.name} — open`,
      onclick: () => selectItem(id),
    },
    [
      el("span", { class: "icon" }, it.icon),
      el("span", {}, opts.hideQty ? ` ${it.name}` : ` ${qty} ${it.name}`),
    ],
  );
}
