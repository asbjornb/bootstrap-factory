import { ITEMS, stackSize } from "../data/items";
import {
  carryCap,
  eat,
  gameMinutes,
  getLastTrashed,
  inventorySlotsUsed,
  pickUpAllFromFloor,
  pickUpFromFloor,
  restoreLastTrashed,
  save,
  store,
  subscribeLastTrashed,
} from "../game/state";
import type { ItemId } from "../data/types";
import { clear, el } from "./dom";
import { iconEl } from "./icon";
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
      iconEl(it.id, it.icon, "slot-icon"),
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

    const lastTrashed = getLastTrashed();
    const undoBtn = lastTrashed
      ? (() => {
          const it = ITEMS[lastTrashed.itemId]!;
          const where =
            lastTrashed.source === "inventory"
              ? "inventory"
              : lastTrashed.source === "floor"
                ? "floor"
                : "chest";
          return el(
            "button",
            {
              class: "trash-undo small",
              title: `Put ${lastTrashed.qty}× ${it.name} back in your ${where}`,
              onclick: () => {
                if (restoreLastTrashed()) save();
              },
            },
            [
              el("span", { class: "icon" }, "↩"),
              el("span", {}, `Undo: ${lastTrashed.qty}× ${it.name}`),
            ],
          );
        })()
      : null;

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

    const pantry = renderPantry(entries as [ItemId, number][], s);

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
          undoBtn,
        ]),
        grid,
        pantry,
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
  subscribeLastTrashed(render);
}

function renderPantry(
  entries: [ItemId, number][],
  state: ReturnType<typeof store.get>,
): HTMLElement | null {
  const foods = entries.filter(([id]) => ITEMS[id]?.food);
  if (foods.length === 0) return null;
  const now = gameMinutes(state);
  return el("div", { class: "pantry" }, [
    el("h3", {}, "Pantry"),
    el("p", { class: "muted small" }, "Eat to refill stamina."),
    el(
      "div",
      { class: "pantry-list" },
      foods.map(([id, qty]) => {
        const it = ITEMS[id]!;
        const mins = it.food!.satiatesMinutes;
        const batches = state.perishables[id];
        const oldest = batches && batches.length > 0 ? batches[0]! : null;
        const fresh = oldest ? formatFreshness(oldest.expiresAt - now) : null;
        const batchSuffix =
          batches && batches.length > 1 ? ` (${batches.length} batches)` : "";
        const title = fresh
          ? `Eat one ${it.name} (+${mins} min). You have ${qty}. Oldest ${oldest!.qty} spoils in ${fresh}${batchSuffix}.`
          : `Eat one ${it.name} (+${mins} min). You have ${qty}. Keeps indefinitely.`;
        return el(
          "button",
          {
            class: "eat-btn",
            title,
            onclick: () => {
              if (eat(id)) save();
            },
          },
          [
            iconEl(it.id, it.icon),
            el("span", {}, `Eat ${it.name}`),
            el("span", { class: "eat-mins" }, `+${mins}m`),
            el("span", { class: "eat-qty" }, `×${qty}`),
            fresh
              ? el(
                  "span",
                  {
                    class: "eat-fresh small",
                    title: "Time until the oldest batch spoils",
                  },
                  `🪰 ${fresh}${batchSuffix}`,
                )
              : null,
          ],
        );
      }),
    ),
  ]);
}

function formatFreshness(minsLeft: number): string {
  if (minsLeft <= 0) return "now";
  if (minsLeft < 60) return `${Math.round(minsLeft)} min`;
  const h = minsLeft / 60;
  if (h < 24) return h % 1 === 0 ? `${h} h` : `${h.toFixed(1)} h`;
  const d = h / 16; // in-world days are 16 active hours.
  return d < 2 ? `~1 day` : `~${Math.round(d)} days`;
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
