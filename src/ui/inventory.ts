import { ITEMS } from "../data/items";
import { store } from "../game/state";
import { clear, el } from "./dom";
import { selectItem } from "./recipe-index";

export function mountInventory(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    const entries = Object.entries(s.inventory).sort((a, b) =>
      ITEMS[a[0]]!.name.localeCompare(ITEMS[b[0]]!.name),
    );
    clear(root);
    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Inventory"),
        entries.length === 0
          ? el("p", { class: "muted" }, "Empty. Try gathering something.")
          : el(
              "ul",
              { class: "inventory-list" },
              entries.map(([id, qty]) => {
                const it = ITEMS[id]!;
                return el(
                  "li",
                  {
                    class: "inv-row",
                    title: `${it.name} — click to open in Recipe Index`,
                    onclick: () => selectItem(id),
                  },
                  [
                    el("span", { class: "icon" }, it.icon),
                    el("span", { class: "name" }, it.name),
                    el("span", { class: "qty" }, String(qty)),
                  ],
                );
              }),
            ),
      ]),
    );
  };
  render();
  store.subscribe(render);
}
