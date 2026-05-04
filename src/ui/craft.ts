import { ITEMS } from "../data/items";
import { ALL_MACHINES, MACHINES } from "../data/machines";
import { ALL_RECIPES, RECIPES } from "../data/recipes";
import {
  activeJobsFor,
  bestToolTier,
  canCraft,
  craft,
  freeSlotsFor,
  hasInputsAndTool,
  machineCapacity,
  onTick,
  save,
  store,
  togglePin,
} from "../game/state";
import type { Machine, Recipe } from "../data/types";
import type { MachineJob } from "../game/state";
import { clear, el } from "./dom";
import { selectItem } from "./recipe-index";

export function mountCraft(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    clear(root);

    const groups = ALL_MACHINES.map((m) => {
      const capacity = machineCapacity(s, m.id);
      const recipes =
        capacity > 0
          ? ALL_RECIPES.filter(
              (r) => r.machine === m.id && hasInputsAndTool(s, r),
            )
          : [];
      const jobs = activeJobsFor(s, m.id);
      return { machine: m, recipes, jobs, capacity };
    }).filter((g) => g.recipes.length > 0 || g.jobs.length > 0);

    const pinnedRecipes = s.pinnedRecipes
      .map((id) => RECIPES[id])
      .filter((r): r is Recipe => !!r);

    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Craft"),
        el(
          "p",
          { class: "muted small" },
          "Recipes you can run right now. Look up others in the Recipe Index.",
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
                pinnedRecipes.map((r) => recipeButton(r, true)),
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
                      g.recipes.map((r) => recipeButton(r)),
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
    for (const bar of root.querySelectorAll<HTMLElement>(".job-progress-fill")) {
      const start = Number(bar.dataset.start);
      const end = Number(bar.dataset.end);
      if (!start || !end) continue;
      const pct = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
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
  const pct = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
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

function recipeButton(r: Recipe, pinned = false): HTMLElement {
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
                  selectItem(i.item);
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
  if (reason === "missing_inputs") {
    const missing = r.inputs.filter((i) => (s.inventory[i.item] ?? 0) < i.qty);
    if (missing.length > 0) {
      const list = missing
        .map((i) => `${(i.qty - (s.inventory[i.item] ?? 0))}× ${ITEMS[i.item]!.name}`)
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
