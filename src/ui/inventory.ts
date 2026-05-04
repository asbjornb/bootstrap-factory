import { ITEMS, stackSize } from "../data/items";
import {
  carryCap,
  inventorySlotsUsed,
  pickUpAllFromFloor,
  pickUpFromFloor,
  save,
  store,
} from "../game/state";
import { clear, el } from "./dom";
import { selectItem } from "./recipe-index";
import {
  applyTrash,
  isTrashMode,
  makeDraggable,
  subscribeTrashMode,
  wireTrashTarget,
} from "./trash-drag";

export function mountInventory(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    const entries = Object.entries(s.inventory).sort((a, b) =>
      ITEMS[a[0]]!.name.localeCompare(ITEMS[b[0]]!.name),
    );
    const used = inventorySlotsUsed(s);
    const cap = carryCap(s);
    const full = used >= cap;
    const floorEntries = Object.entries(s.floor)
      .filter(([, q]) => q > 0)
      .sort((a, b) => ITEMS[a[0]]!.name.localeCompare(ITEMS[b[0]]!.name));

    const armed = isTrashMode();

    clear(root);
    const trashZone = el(
      "div",
      {
        class: "trash-zone" + (armed ? " armed" : ""),
        role: "button",
        tabindex: "0",
        title: armed
          ? "Trash mode on — tap an item to discard it. Tap here to turn off."
          : "Drag an item stack here, or tap to enter trash mode and tap items to discard",
      },
      [
        el("span", { class: "icon" }, "🗑️"),
        el("span", { class: "small" }, armed ? "Trashing… tap to stop" : "Trash"),
      ],
    );
    wireTrashTarget(trashZone);

    root.appendChild(
      el("div", { class: "panel" }, [
        el("div", { class: "inv-head" }, [
          el("h2", {}, "Inventory"),
          el(
            "span",
            {
              class: "inv-cap small" + (full ? " full" : ""),
              title: "Slots used / total carry capacity. Each item type uses at least one slot; bigger stacks need more.",
            },
            `${used} / ${cap} slots`,
          ),
          trashZone,
        ]),
        entries.length === 0
          ? el("p", { class: "muted" }, "Empty. Try gathering something.")
          : el(
              "ul",
              { class: "inventory-list" },
              entries.map(([id, qty]) => {
                const it = ITEMS[id]!;
                const stack = stackSize(id);
                const slots = Math.ceil(qty / stack);
                const row = el(
                  "li",
                  {
                    class: "inv-row",
                    title: armed
                      ? `Tap to discard ${qty}× ${it.name}`
                      : `${it.name} — ${qty} (${slots} slot${slots === 1 ? "" : "s"} of ${stack}) — click to open in Recipe Index, or drag to trash`,
                    onclick: () => {
                      if (isTrashMode()) {
                        if (applyTrash({ source: "inventory", itemId: id })) save();
                        return;
                      }
                      selectItem(id);
                    },
                  },
                  [
                    el("span", { class: "icon" }, it.icon),
                    el("span", { class: "name" }, it.name),
                    el("span", { class: "qty" }, String(qty)),
                  ],
                );
                makeDraggable(row, { source: "inventory", itemId: id });
                return row;
              }),
            ),
        floorEntries.length > 0
          ? el("div", { class: "floor-pile" }, [
              el("div", { class: "floor-head" }, [
                el("h3", {}, "On the floor"),
                el(
                  "button",
                  {
                    class: "small floor-pickup-all",
                    title: "Pick up everything that fits",
                    onclick: () => {
                      pickUpAllFromFloor();
                      save();
                    },
                  },
                  "Pick up all",
                ),
              ]),
              el(
                "p",
                { class: "muted small" },
                "Stuff that didn't fit in your pockets. Build a crate, free up some slots, or pick it back up.",
              ),
              el(
                "ul",
                { class: "inventory-list" },
                floorEntries.map(([id, qty]) => {
                  const it = ITEMS[id]!;
                  const row = el(
                    "li",
                    {
                      class: "inv-row floor-row",
                      title: armed
                        ? `Tap to discard ${qty}× ${it.name}`
                        : `Click to pick up ${qty}× ${it.name}, or drag to trash`,
                      onclick: () => {
                        if (isTrashMode()) {
                          if (applyTrash({ source: "floor", itemId: id })) save();
                          return;
                        }
                        pickUpFromFloor(id);
                        save();
                      },
                    },
                    [
                      el("span", { class: "icon" }, it.icon),
                      el("span", { class: "name" }, it.name),
                      el("span", { class: "qty" }, String(qty)),
                    ],
                  );
                  makeDraggable(row, { source: "floor", itemId: id });
                  return row;
                }),
              ),
            ])
          : null,
      ]),
    );
  };
  render();
  store.subscribe(render);
  subscribeTrashMode(render);
}
