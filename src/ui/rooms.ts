import { ITEMS } from "../data/items";
import { ALL_MACHINES, MACHINES } from "../data/machines";
import {
  ROOM_BUILD_COST,
  ROOM_BUILD_TOOL,
  activeJobsFor,
  buildRoom,
  canBuildRoom,
  meetsToolReq,
  pickupMachine,
  placeMachine,
  placedMachineCount,
  renameRoom,
  save,
  store,
} from "../game/state";
import type { Room } from "../data/types";
import { clear, el } from "./dom";

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

    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Rooms"),
        el(
          "p",
          { class: "muted small" },
          "Machines must be placed in a room before you can use them. Hand-crafting works anywhere.",
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
              "No rooms yet. Forage logs, knap a flint shovel, and build your first room.",
            )
          : el(
              "div",
              { class: "room-list" },
              s.rooms.map((r) => renderRoom(r, placeableMachines)),
            ),
      ]),
    );
  };
  render();
  store.subscribe(render);
}

function renderRoom(
  room: Room,
  placeable: { id: string; name: string; icon: string }[],
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
    placeable.length > 0
      ? el("div", { class: "room-place-row" }, [
          el("span", { class: "small muted" }, "Place:"),
          ...placeable.map((m) => {
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
        ])
      : el(
          "p",
          { class: "muted small" },
          "Craft a machine to place it here.",
        ),
  ]);
}
