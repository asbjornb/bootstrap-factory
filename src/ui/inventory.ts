import { ITEMS, stackSize } from "../data/items";
import {
  carryCap,
  inventorySlotsUsed,
  pickUpAllFromFloor,
  pickUpFromFloor,
  save,
  store,
} from "../game/state";
import type { ItemId } from "../data/types";
import { clear, el } from "./dom";
import { selectItem } from "./recipe-index";
import {
  applyTrash,
  isTrashMode,
  makeDraggable,
  subscribeTrashMode,
  TrashSource,
  wireTrashTarget,
} from "./trash-drag";

interface SlotFill {
  id: ItemId;
  qty: number;
}

/** Expand item totals into per-slot fills (one entry per slot). */
function explodeToSlots(entries: Array<[ItemId, number]>): SlotFill[] {
  const out: SlotFill[] = [];
  for (const [id, total] of entries) {
    let remaining = total;
    const stack = stackSize(id);
    while (remaining > 0) {
      const take = Math.min(remaining, stack);
      out.push({ id, qty: take });
      remaining -= take;
    }
  }
  return out;
}

interface SlotOptions {
  /** "" if not draggable. */
  drag?: TrashSource;
  /** Hover title. Receives item, total qty across the same item-type, slot qty. */
  title: (id: ItemId, totalQty: number, slotQty: number) => string;
  onClick: (id: ItemId) => void;
  extraClass?: string;
}

function renderSlot(
  fill: SlotFill,
  totalQty: number,
  opts: SlotOptions,
): HTMLElement {
  const it = ITEMS[fill.id]!;
  const slot = el(
    "div",
    {
      class: "slot" + (opts.extraClass ? ` ${opts.extraClass}` : ""),
      title: opts.title(fill.id, totalQty, fill.qty),
      onclick: () => opts.onClick(fill.id),
    },
    [
      el("span", { class: "slot-icon" }, it.icon),
      el("span", { class: "slot-qty" }, String(fill.qty)),
    ],
  );
  if (opts.drag) makeDraggable(slot, opts.drag);
  return slot;
}

function emptySlot(): HTMLElement {
  return el("div", { class: "slot empty" });
}

export function mountInventory(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    const entries = Object.entries(s.inventory)
      .filter(([, q]) => q > 0)
      .sort((a, b) => ITEMS[a[0]]!.name.localeCompare(ITEMS[b[0]]!.name));
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

    const totals = new Map<ItemId, number>(entries as [ItemId, number][]);
    const fills = explodeToSlots(entries as [ItemId, number][]);

    const grid = el("div", { class: "slot-grid", style: "--cols: 4" });
    for (const f of fills) {
      grid.appendChild(
        renderSlot(f, totals.get(f.id)!, {
          drag: { source: "inventory", itemId: f.id },
          title: (id, total, slotQty) => {
            const it = ITEMS[id]!;
            return armed
              ? `Tap to discard ${total}× ${it.name}`
              : `${it.name} — ${slotQty}${
                  total !== slotQty ? ` (of ${total})` : ""
                } — click to open in Recipe Index, or drag to trash`;
          },
          onClick: (id) => {
            if (isTrashMode()) {
              if (applyTrash({ source: "inventory", itemId: id })) save();
              return;
            }
            selectItem(id);
          },
        }),
      );
    }
    for (let i = fills.length; i < cap; i++) grid.appendChild(emptySlot());

    root.appendChild(
      el("div", { class: "panel" }, [
        el("div", { class: "inv-head" }, [
          el("h2", {}, "Inventory"),
          el(
            "span",
            {
              class: "inv-cap small" + (full ? " full" : ""),
              title:
                "Slots used / total carry capacity. Each item type uses at least one slot; bigger stacks need more.",
            },
            `${used} / ${cap} slots`,
          ),
          trashZone,
        ]),
        grid,
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
              renderFloorGrid(floorEntries as [ItemId, number][], armed),
            ])
          : null,
      ]),
    );
  };
  render();
  store.subscribe(render);
  subscribeTrashMode(render);
}

function renderFloorGrid(
  entries: [ItemId, number][],
  armed: boolean,
): HTMLElement {
  const totals = new Map<ItemId, number>(entries);
  const fills = explodeToSlots(entries);
  const grid = el("div", { class: "slot-grid", style: "--cols: 4" });
  for (const f of fills) {
    grid.appendChild(
      renderSlot(f, totals.get(f.id)!, {
        extraClass: "floor",
        drag: { source: "floor", itemId: f.id },
        title: (id, total) => {
          const it = ITEMS[id]!;
          return armed
            ? `Tap to discard ${total}× ${it.name}`
            : `Click to pick up ${total}× ${it.name}, or drag to trash`;
        },
        onClick: (id) => {
          if (isTrashMode()) {
            if (applyTrash({ source: "floor", itemId: id })) save();
            return;
          }
          pickUpFromFloor(id);
          save();
        },
      }),
    );
  }
  return grid;
}
