import { ITEMS } from "../data/items";
import { ALL_MACHINES, MACHINES } from "../data/machines";
import { ALL_RECIPES, RECIPES } from "../data/recipes";
import {
  activeJobsFor,
  canCraft,
  craft,
  freeSlotsFor,
  hasInputsAndTool,
  machineCapacity,
  onTick,
  save,
  store,
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
      const recipes = ALL_RECIPES.filter(
        (r) => r.machine === m.id && hasInputsAndTool(s, r),
      );
      const jobs = activeJobsFor(s, m.id);
      const capacity = machineCapacity(s, m.id);
      return { machine: m, recipes, jobs, capacity };
    }).filter((g) => g.recipes.length > 0 || g.jobs.length > 0);

    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Craft"),
        el(
          "p",
          { class: "muted small" },
          "Recipes you can run right now. Look up others in the Recipe Index.",
        ),
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

function recipeButton(r: Recipe): HTMLElement {
  const out = r.outputs[0]!;
  const outItem = ITEMS[out.item]!;
  const s = store.get();
  const check = canCraft(s, r);
  const busy = check.reason === "machine_busy";
  const disabled = !check.ok;
  const free = freeSlotsFor(s, r.machine);

  return el(
    "div",
    { class: "recipe-card" + (disabled ? " locked" : "") },
    [
      el(
        "button",
        {
          class: "recipe-craft-btn",
          disabled: disabled,
          title: busy
            ? `${MACHINES[r.machine]!.name} is busy — build another to run in parallel`
            : `Craft ${out.qty}× ${outItem.name}`,
          onclick: () => {
            if (craft(r.id).ok) save();
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
          ...r.inputs.map((i) =>
            el(
              "span",
              {
                class: "ingredient",
                title: `${ITEMS[i.item]!.name} — open in Recipe Index`,
                onclick: (ev: Event) => {
                  ev.stopPropagation();
                  selectItem(i.item);
                },
              },
              [
                el("span", { class: "icon" }, ITEMS[i.item]!.icon),
                ` ${i.qty}`,
              ],
            ),
          ),
          r.tool
            ? el("span", { class: "tool-req" }, `🛠 ${r.tool.type} ≥${r.tool.minTier}`)
            : null,
          r.durationMs && r.durationMs > 0
            ? el("span", { class: "duration" }, `⏱ ${formatDuration(r.durationMs)}`)
            : null,
        ],
      ),
      el(
        "div",
        { class: "recipe-foot small muted" },
        busy
          ? `${MACHINES[r.machine]!.name} busy (${free}/${machineCapacity(s, r.machine)} free)`
          : `at ${MACHINES[r.machine]!.name}`,
      ),
    ],
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`;
}
