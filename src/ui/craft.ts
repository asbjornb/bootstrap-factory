import { ITEMS, itemsWithTag } from "../data/items";
import { ALL_MACHINES, MACHINES } from "../data/machines";
import { ALL_RECIPES, RECIPES } from "../data/recipes";
import {
  activeJobsFor,
  bestToolTier,
  canCraft,
  craft,
  freeSlotsFor,
  gameNow,
  hasInputsAndTool,
  machineCapacity,
  onTick,
  producesObsoleteTool,
  save,
  SEASONS,
  store,
  togglePin,
  totalAvailableForTag,
} from "../game/state";
import { isTagInput } from "../data/types";
import type { ItemId, Machine, Recipe, RecipeInput } from "../data/types";
import type { MachineJob } from "../game/state";
import { clear, el } from "./dom";

interface CraftOptions {
  onOpenItem: (id: ItemId) => void;
}

export function mountCraft(root: HTMLElement, opts: CraftOptions): void {
  const { onOpenItem } = opts;
  const render = () => {
    const s = store.get();
    clear(root);

    // Only show hand recipes here — recipes for placed machines are accessed
    // by clicking the machine itself in its room.
    const groups = ALL_MACHINES.filter((m) => m.id === "hand").map((m) => {
      const capacity = machineCapacity(s, m.id);
      const recipes =
        capacity > 0
          ? ALL_RECIPES.filter(
              (r) =>
                r.machine === m.id &&
                hasInputsAndTool(s, r) &&
                !producesObsoleteTool(s, r),
            )
          : [];
      const jobs = activeJobsFor(s, m.id);
      return { machine: m, recipes, jobs, capacity };
    }).filter((g) => g.recipes.length > 0 || g.jobs.length > 0);

    const pinnedRecipes = s.pinnedRecipes
      .map((id) => RECIPES[id])
      .filter((r): r is Recipe => !!r && !producesObsoleteTool(s, r));

    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Craft"),
        el(
          "p",
          { class: "muted small" },
          "By-hand recipes. For machine recipes, click a machine in its room. Look up the full set in the Recipe Index.",
        ),
        pinnedRecipes.length > 0
          ? el("div", { class: "craft-pinned" }, [
              el("h3", {}, [
                el("span", { class: "icon" }, "📌"),
                " Pinned",
              ]),
              el(
                "div",
                { class: "recipe-grid" },
                pinnedRecipes.map((r) => recipeButton(r, true, onOpenItem)),
              ),
            ])
          : null,
        ...(groups.length === 0
          ? [
              el(
                "p",
                { class: "muted small" },
                "Nothing craftable yet — gather some materials first.",
              ),
            ]
          : groups.map((g) =>
              el("div", { class: "craft-group" }, [
                machineHeader(g.machine, g.capacity, g.jobs.length),
                g.jobs.length > 0
                  ? el(
                      "div",
                      { class: "job-list" },
                      g.jobs.map((j) => jobRow(j)),
                    )
                  : null,
                g.recipes.length > 0
                  ? el(
                      "div",
                      { class: "recipe-grid" },
                      g.recipes.map((r) => recipeButton(r, false, onOpenItem)),
                    )
                  : null,
              ]),
            )),
      ]),
    );
  };
  render();
  store.subscribe(render);
  // Repaint progress bars between state changes.
  onTick(() => {
    const now = gameNow();
    for (const bar of root.querySelectorAll<HTMLElement>(".job-progress-fill")) {
      const start = Number(bar.dataset.start);
      const end = Number(bar.dataset.end);
      if (!start || !end) continue;
      const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
      bar.style.width = `${pct}%`;
    }
  });
}

function machineHeader(m: Machine, capacity: number, busy: number): HTMLElement {
  const free = capacity - busy;
  return el("h3", {}, [
    el("span", { class: "icon" }, m.icon),
    " ",
    m.name,
    capacity > 0
      ? el(
          "span",
          {
            class: "machine-slots small muted",
            title: `${busy} busy, ${free} free`,
          },
          ` ${free}/${capacity} free`,
        )
      : null,
  ]);
}

function jobRow(j: MachineJob): HTMLElement {
  const r = RECIPES[j.recipeId];
  const out = r?.outputs[0];
  const outItem = out ? ITEMS[out.item] : undefined;
  const start = j.startedAt;
  const end = j.endsAt;
  const pct = Math.min(100, Math.max(0, ((gameNow() - start) / (end - start)) * 100));
  return el("div", { class: "job-row" }, [
    el("span", { class: "icon" }, outItem?.icon ?? "⏳"),
    el(
      "span",
      { class: "job-label small" },
      out && outItem ? `${out.qty}× ${outItem.name}` : j.recipeId,
    ),
    el("div", { class: "job-progress" }, [
      el("div", {
        class: "job-progress-fill",
        style: `width: ${pct}%`,
        "data-start": String(start),
        "data-end": String(end),
      }),
    ]),
  ]);
}

function recipeButton(
  r: Recipe,
  pinned: boolean,
  onOpenItem: (id: ItemId) => void,
): HTMLElement {
  const out = r.outputs[0]!;
  const outItem = ITEMS[out.item]!;
  const s = store.get();
  const check = canCraft(s, r);
  const busy = check.reason === "machine_busy";
  const disabled = !check.ok;
  const free = freeSlotsFor(s, r.machine);

  return el(
    "div",
    { class: "recipe-card" + (disabled ? " locked" : "") + (pinned ? " pinned" : "") },
    [
      pinned
        ? el(
            "button",
            {
              class: "pin-btn pinned card-pin",
              title: "Unpin",
              "aria-label": "Unpin recipe",
              onclick: (ev: Event) => {
                ev.stopPropagation();
                togglePin(r.id);
              },
            },
            "📌",
          )
        : null,
      el(
        "button",
        {
          class: "recipe-craft-btn",
          disabled: disabled,
          title: busy
            ? `${MACHINES[r.machine]!.name} is busy — build another to run in parallel`
            : `Craft ${out.qty}× ${outItem.name}`,
          onclick: (ev: Event) => {
            const btn = ev.currentTarget as HTMLElement;
            btn.classList.add("flash");
            requestAnimationFrame(() => {
              setTimeout(() => {
                if (craft(r.id).ok) save();
              }, 60);
            });
          },
        },
        [
          el("span", { class: "icon big" }, outItem.icon),
          el("span", {}, `${out.qty}× ${outItem.name}`),
        ],
      ),
      el(
        "div",
        { class: "recipe-meta" },
        [
          ...r.inputs.map((i) => {
            if (isTagInput(i)) {
              const have = totalAvailableForTag(s, i.tag);
              const short = have < i.qty;
              const matches = itemsWithTag(i.tag);
              const first = matches[0];
              const label = `Any ${i.tag}`;
              const detail = matches.map((m) => m.name).join(", ");
              return el(
                "span",
                {
                  class: "ingredient tag-input" + (short && pinned ? " short" : ""),
                  title:
                    short && pinned
                      ? `${label} — have ${have}/${i.qty} (${detail})`
                      : `${label} — any of: ${detail}`,
                  onclick: (ev: Event) => {
                    ev.stopPropagation();
                    if (first) onOpenItem(first.id);
                  },
                },
                [
                  el("span", { class: "icon" }, first?.icon ?? "•"),
                  ` ${pinned && short ? `${have}/${i.qty}` : i.qty} ${label}`,
                ],
              );
            }
            const have = s.inventory[i.item] ?? 0;
            const short = have < i.qty;
            return el(
              "span",
              {
                class: "ingredient" + (short && pinned ? " short" : ""),
                title:
                  short && pinned
                    ? `${ITEMS[i.item]!.name} — have ${have}/${i.qty}`
                    : `${ITEMS[i.item]!.name} — open in Recipe Index`,
                onclick: (ev: Event) => {
                  ev.stopPropagation();
                  onOpenItem(i.item);
                },
              },
              [
                el("span", { class: "icon" }, ITEMS[i.item]!.icon),
                ` ${pinned && short ? `${have}/${i.qty}` : i.qty}`,
              ],
            );
          }),
          r.tool
            ? (() => {
                const tier = bestToolTier(s, r.tool!.type);
                const short = tier < r.tool!.minTier;
                return el(
                  "span",
                  { class: "tool-req" + (short && pinned ? " short" : "") },
                  `🛠 ${r.tool!.type} ≥${r.tool!.minTier}`,
                );
              })()
            : null,
          r.durationMs && r.durationMs > 0
            ? el("span", { class: "duration" }, `⏱ ${formatDuration(r.durationMs)}`)
            : null,
        ],
      ),
      el(
        "div",
        { class: "recipe-foot small muted" },
        pinned && disabled
          ? missingSummary(r, check.reason)
          : busy
            ? `${MACHINES[r.machine]!.name} busy (${free}/${machineCapacity(s, r.machine)} free)`
            : `at ${MACHINES[r.machine]!.name}`,
      ),
    ],
  );
}

function missingSummary(r: Recipe, reason: string | undefined): string {
  const s = store.get();
  if (reason === "missing_tool" && r.tool) {
    return `Need ${r.tool.type} (tier ≥${r.tool.minTier})`;
  }
  if (reason === "machine_busy") {
    const cap = machineCapacity(s, r.machine);
    if (cap === 0) return `Need ${MACHINES[r.machine]!.name}`;
    return `${MACHINES[r.machine]!.name} busy`;
  }
  if (reason === "wrong_season" && r.seasons) {
    const names = r.seasons.map((i) => SEASONS[i]).join("/");
    return `Plant in ${names}`;
  }
  if (reason === "missing_inputs") {
    const missing = r.inputs.filter((i) => {
      const have = isTagInput(i) ? totalAvailableForTag(s, i.tag) : (s.inventory[i.item] ?? 0);
      return have < i.qty;
    });
    if (missing.length > 0) {
      const list = missing
        .map((i: RecipeInput) => {
          if (isTagInput(i)) {
            const need = i.qty - totalAvailableForTag(s, i.tag);
            return `${need}× any ${i.tag}`;
          }
          return `${(i.qty - (s.inventory[i.item] ?? 0))}× ${ITEMS[i.item]!.name}`;
        })
        .join(", ");
      return `Need ${list}`;
    }
  }
  return `at ${MACHINES[r.machine]!.name}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`;
}
