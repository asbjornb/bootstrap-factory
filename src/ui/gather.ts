import { ALL_GATHER_ACTIONS } from "../data/gather";
import { ITEMS } from "../data/items";
import { bestToolTier, gather, save, store } from "../game/state";
import { clear, el } from "./dom";

export function mountGather(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    clear(root);
    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Gather"),
        el(
          "div",
          { class: "gather-grid" },
          ALL_GATHER_ACTIONS.map((a) => {
            const lockedDrops = a.drops.filter(
              (d) => d.requiresTool && bestToolTier(s, d.requiresTool.type) < d.requiresTool.minTier,
            );
            return el("div", { class: "gather-card" }, [
              el(
                "button",
                {
                  class: "gather-btn",
                  onclick: () => {
                    gather(a.id);
                    save();
                  },
                },
                [el("span", { class: "icon big" }, a.icon), el("span", {}, a.name)],
              ),
              el("p", { class: "muted small" }, a.description ?? ""),
              lockedDrops.length > 0
                ? el(
                    "p",
                    { class: "small" },
                    `Better tools could yield: ${lockedDrops
                      .map((d) => ITEMS[d.item]!.name)
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .join(", ")}.`,
                  )
                : null,
            ]);
          }),
        ),
      ]),
    );
  };
  render();
  store.subscribe(render);
}
