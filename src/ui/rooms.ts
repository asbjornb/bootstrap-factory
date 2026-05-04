import { ITEMS, stackSize } from "../data/items";
import { ALL_MACHINES, MACHINES } from "../data/machines";
import {
  CHEST_SLOT_CAP,
  ROOM_BUILD_COST,
  ROOM_BUILD_TOOL,
  activeJobsFor,
  buildRoom,
  canBuildRoom,
  chestSlotCap,
  chestSlotsUsed,
  depositToChest,
  meetsToolReq,
  pickupChest,
  pickupMachine,
  placeChest,
  placeMachine,
  placedMachineCount,
  renameRoom,
  save,
  store,
  withdrawFromChest,
} from "../game/state";
import type { Chest, ItemId, Room } from "../data/types";
import { clear, el } from "./dom";

const CHEST_TYPES = Object.keys(CHEST_SLOT_CAP);

export function mountRooms(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    clear(root);

    const buildCheck = canBuildRoom(s);
    const costSummary = ROOM_BUILD_COST.map(
      (c) => `${c.qty}× ${ITEMS[c.item]?.name ?? c.item}`,
    ).join(", ");
    const toolOk = meetsToolReq(s, ROOM_BUILD_TOOL);

    const placeableMachines = ALL_MACHINES.filter(
      (m) => m.id !== "hand" && (s.inventory[m.id] ?? 0) > 0,
    );
    const placeableChests = CHEST_TYPES.filter((id) => (s.inventory[id] ?? 0) > 0);

    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Rooms"),
        el(
          "p",
          { class: "muted small" },
          "Machines must be placed in a room before you can use them. Chests in any room act as a shared pantry — recipes pull from them automatically.",
        ),
        el("div", { class: "room-build-row" }, [
          el(
            "button",
            {
              class: "build-room-btn",
              disabled: !buildCheck.ok,
              title: !toolOk
                ? `Needs ${ROOM_BUILD_TOOL.type} (tier ≥ ${ROOM_BUILD_TOOL.minTier})`
                : !buildCheck.ok
                  ? `Costs ${costSummary}`
                  : "Build a new room",
              onclick: () => {
                if (buildRoom().ok) save();
              },
            },
            "+ Build Room",
          ),
          el(
            "span",
            { class: "small muted" },
            `Cost: ${costSummary} · Needs ${ROOM_BUILD_TOOL.type} ≥${ROOM_BUILD_TOOL.minTier}`,
          ),
        ]),
        s.rooms.length === 0
          ? el(
              "p",
              { class: "muted small" },
              "No rooms yet. Gather wood, craft a shovel, and build your first room.",
            )
          : el(
              "div",
              { class: "room-list" },
              s.rooms.map((r) => renderRoom(r, placeableMachines, placeableChests)),
            ),
      ]),
    );
  };
  render();
  store.subscribe(render);
}

function renderRoom(
  room: Room,
  placeableMachines: { id: string; name: string; icon: string }[],
  placeableChests: ItemId[],
): HTMLElement {
  const s = store.get();
  const placedEntries = Object.entries(room.machines).filter(([, n]) => n > 0);

  return el("div", { class: "room-card" }, [
    el("div", { class: "room-head" }, [
      el("input", {
        class: "room-name",
        type: "text",
        value: room.name,
        title: "Rename room",
        onchange: (ev: Event) => {
          const v = (ev.target as HTMLInputElement).value;
          renameRoom(room.id, v);
          save();
        },
      }),
    ]),
    placedEntries.length === 0
      ? el("p", { class: "muted small" }, "Empty. Place a machine below.")
      : el(
          "div",
          { class: "room-machines" },
          placedEntries.map(([machineId, count]) => {
            const m = MACHINES[machineId];
            if (!m) return null;
            const busy = activeJobsFor(s, machineId).length;
            const totalPlaced = placedMachineCount(s, machineId);
            const canPickup = totalPlaced - busy >= 1;
            return el("div", { class: "room-machine" }, [
              el("span", { class: "icon" }, m.icon),
              el("span", { class: "name" }, m.name),
              el("span", { class: "qty" }, `×${count}`),
              el(
                "button",
                {
                  class: "pickup-btn small",
                  disabled: !canPickup,
                  title: canPickup
                    ? "Take one back into inventory"
                    : "All instances are currently busy",
                  onclick: () => {
                    if (pickupMachine(room.id, machineId)) save();
                  },
                },
                "↑",
              ),
            ]);
          }),
        ),
    room.chests.length > 0
      ? el(
          "div",
          { class: "room-chests" },
          room.chests.map((c) => renderChest(room.id, c)),
        )
      : null,
    placeableMachines.length > 0 || placeableChests.length > 0
      ? el("div", { class: "room-place-row" }, [
          el("span", { class: "small muted" }, "Place:"),
          ...placeableMachines.map((m) => {
            const owned = s.inventory[m.id] ?? 0;
            return el(
              "button",
              {
                class: "place-btn small",
                disabled: owned < 1,
                title: `Place ${m.name} here (${owned} in inventory)`,
                onclick: () => {
                  if (placeMachine(room.id, m.id)) save();
                },
              },
              [el("span", { class: "icon" }, m.icon), ` ${m.name}`],
            );
          }),
          ...placeableChests.map((id) => {
            const it = ITEMS[id]!;
            const owned = s.inventory[id] ?? 0;
            return el(
              "button",
              {
                class: "place-btn small",
                disabled: owned < 1,
                title: `Place ${it.name} here (${owned} in inventory)`,
                onclick: () => {
                  if (placeChest(room.id, id)) save();
                },
              },
              [el("span", { class: "icon" }, it.icon), ` ${it.name}`],
            );
          }),
        ])
      : el(
          "p",
          { class: "muted small" },
          "Craft a machine or chest to place it here.",
        ),
  ]);
}

function renderChest(roomId: string, chest: Chest): HTMLElement {
  const s = store.get();
  const chestItem = ITEMS[chest.type]!;
  const cap = chestSlotCap(chest.type);
  const used = chestSlotsUsed(chest);
  const empty = used === 0;

  const stored = Object.entries(chest.contents)
    .filter(([, q]) => q > 0)
    .sort((a, b) => ITEMS[a[0]]!.name.localeCompare(ITEMS[b[0]]!.name));

  // Items in player inventory that this chest could accept (it has slot space
  // for them either in an existing partial stack of the same type or in a fresh slot).
  const depositable = Object.entries(s.inventory)
    .filter(([id, qty]) => {
      if (qty <= 0) return false;
      const stack = stackSize(id);
      const currentQty = chest.contents[id] ?? 0;
      const currentSlots = Math.ceil(currentQty / stack);
      const availableSlots = cap - (used - currentSlots);
      const maxQty = availableSlots * stack;
      return maxQty > currentQty;
    })
    .sort((a, b) => ITEMS[a[0]]!.name.localeCompare(ITEMS[b[0]]!.name));

  return el("div", { class: "chest-card" }, [
    el("div", { class: "chest-head" }, [
      el("span", { class: "icon" }, chestItem.icon),
      el("span", { class: "name" }, chestItem.name),
      el("span", { class: "small muted" }, `${used} / ${cap} slots`),
      el(
        "button",
        {
          class: "pickup-btn small",
          disabled: !empty,
          title: empty
            ? "Take this chest back into inventory"
            : "Empty the chest before picking it up",
          onclick: () => {
            if (pickupChest(roomId, chest.id)) save();
          },
        },
        "↑",
      ),
    ]),
    stored.length === 0
      ? el("p", { class: "muted small chest-empty" }, "Empty.")
      : el(
          "ul",
          { class: "chest-contents" },
          stored.map(([id, qty]) => {
            const it = ITEMS[id]!;
            return el(
              "li",
              {
                class: "chest-row",
                title: `Click to withdraw ${qty}× ${it.name}`,
                onclick: () => {
                  if (withdrawFromChest(roomId, chest.id, id)) save();
                },
              },
              [
                el("span", { class: "icon" }, it.icon),
                el("span", { class: "name" }, it.name),
                el("span", { class: "qty" }, String(qty)),
                el("span", { class: "withdraw-arrow small muted" }, "↑"),
              ],
            );
          }),
        ),
    depositable.length > 0
      ? el("div", { class: "chest-deposit-row" }, [
          el("span", { class: "small muted" }, "Deposit:"),
          ...depositable.map(([id, qty]) => {
            const it = ITEMS[id]!;
            return el(
              "button",
              {
                class: "deposit-btn small",
                title: `Deposit ${qty}× ${it.name}`,
                onclick: (ev: Event) => {
                  ev.stopPropagation();
                  if (depositToChest(roomId, chest.id, id)) save();
                },
              },
              [
                el("span", { class: "icon" }, it.icon),
                ` ${qty}`,
              ],
            );
          }),
        ])
      : null,
  ]);
}
