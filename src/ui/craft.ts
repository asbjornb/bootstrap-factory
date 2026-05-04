import { ITEMS } from "../data/items";
import { ALL_MACHINES, MACHINES } from "../data/machines";
import { ALL_RECIPES } from "../data/recipes";
import { canCraft, craft, save, store } from "../game/state";
import type { Recipe } from "../data/types";
import { clear, el } from "./dom";
import { selectItem } from "./recipe-index";

export function mountCraft(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    clear(root);

    const groups = ALL_MACHINES.map((m) => ({
      machine: m,
      recipes: ALL_RECIPES.filter((r) => r.machine === m.id),
    })).filter((g) => g.recipes.length > 0);

    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Craft"),
        el("p", { class: "muted small" }, "Recipes you can run from your current inventory and tools."),
        ...groups.map((g) =>
          el("div", { class: "craft-group" }, [
            el("h3", {}, [el("span", { class: "icon" }, g.machine.icon), " ", g.machine.name]),
            el(
              "div",
              { class: "recipe-grid" },
              g.recipes.map((r) => recipeButton(r, s)),
            ),
          ]),
        ),
      ]),
    );
  };
  render();
  store.subscribe(render);
}

function recipeButton(r: Recipe, s: ReturnType<typeof store.get>): HTMLElement {
  const check = canCraft(s, r);
  const out = r.outputs[0]!;
  const outItem = ITEMS[out.item]!;
  const reason = check.ok
    ? ""
    : check.reason === "missing_tool"
      ? ` (need ${r.tool!.type} tier ${r.tool!.minTier})`
      : "";

  return el(
    "div",
    { class: "recipe-card" + (check.ok ? "" : " locked") },
    [
      el(
        "button",
        {
          class: "recipe-craft-btn",
          disabled: !check.ok,
          title: check.ok
            ? `Craft ${out.qty}× ${outItem.name}`
            : `Cannot craft${reason}`,
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
          ...r.inputs.map((i) =>
            el(
              "span",
              {
                class:
                  "ingredient" +
                  ((s.inventory[i.item] ?? 0) >= i.qty ? "" : " missing"),
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
        ],
      ),
      el(
        "div",
        { class: "recipe-foot small muted" },
        `at ${MACHINES[r.machine]!.name}`,
      ),
    ],
  );
}
