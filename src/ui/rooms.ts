import { ITEMS, itemsWithTag, stackSize } from "../data/items";
import { ALL_MACHINES, MACHINES } from "../data/machines";
import { ALL_RECIPES, RECIPES } from "../data/recipes";
import {
  CHEST_SLOT_CAP,
  ROOM_BUILD_COST,
  ROOM_BUILD_TOOL,
  bestToolTier,
  buildRoom,
  canBuildRoom,
  chestPreserveFactor,
  chestSlotCap,
  chestSlotsUsed,
  craftAt,
  depositToChest,
  gameNow,
  hasInputsAndTool,
  hasInputsAndToolIgnoringSeason,
  inSeason,
  inputBufferFree,
  inputBufferTotal,
  jobForInstance,
  MACHINE_INPUT_CAP,
  maxLoadable,
  meetsToolReq,
  onTick,
  pickupChest,
  pickupMachine,
  placeChest,
  placeMachine,
  producesObsoleteCraft,
  renameRoom,
  save,
  SEASONS,
  store,
  takeMachineOutput,
  totalAvailableForInput,
  unloadMachine,
  withdrawFromChest,
} from "../game/state";
import { isTagInput } from "../data/types";
import type {
  ItemId,
  PlacedChest,
  PlacedMachine,
  Recipe,
  Room,
} from "../data/types";
import { clear, el } from "./dom";
import {
  applyTrash,
  isTrashMode,
  makeDraggable,
  subscribeTrashMode,
} from "./trash-drag";

const CHEST_TYPES = Object.keys(CHEST_SLOT_CAP);

/** UI-only selection: which cell instance has its detail panel open. */
let selectedInstanceId: string | null = null;

interface RoomsOptions {
  onOpenItem: (id: ItemId) => void;
  onOpenTag: (tag: string) => void;
}

let openItemCallback: (id: ItemId) => void = () => {};
let openTagCallback: (tag: string) => void = () => {};

export function mountRooms(root: HTMLElement, opts: RoomsOptions): void {
  openItemCallback = opts.onOpenItem;
  openTagCallback = opts.onOpenTag;
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
          "Click a machine to load it with a recipe. Chests in any room act as a shared pantry — recipes pull from them automatically.",
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
              s.rooms.map((r) => renderRoom(r, placeableMachines, placeableChests)),
            ),
      ]),
    );
  };
  render();
  store.subscribe(render);
  subscribeTrashMode(render);
  // Repaint progress bars between state changes.
  onTick(() => {
    const now = gameNow();
    for (const bar of root.querySelectorAll<HTMLElement>(".job-progress-fill")) {
      const start = Number(bar.dataset.start);
      const end = Number(bar.dataset.end);
      if (!start || !end) continue;
      const pct = Math.min(
        100,
        Math.max(0, ((now - start) / (end - start)) * 100),
      );
      bar.style.width = `${pct}%`;
    }
  });
}

function selectCell(instanceId: string): void {
  selectedInstanceId = selectedInstanceId === instanceId ? null : instanceId;
  // Trigger a re-render through the store. State doesn't change but the
  // UI does — flush via a no-op update.
  store.update(() => {});
}

function renderRoom(
  room: Room,
  placeableMachines: { id: string; name: string; icon: string }[],
  placeableChests: ItemId[],
): HTMLElement {
  const selected = room.cells.find((c) => c.instanceId === selectedInstanceId);

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
    room.cells.length === 0
      ? el("p", { class: "muted small" }, "Empty. Place a machine or chest below.")
      : renderRoomGrid(room),
    selected
      ? selected.kind === "machine"
        ? renderMachineDetail(selected)
        : renderChestDetail(room.id, selected)
      : null,
    placeableMachines.length > 0 || placeableChests.length > 0
      ? el("div", { class: "room-place-row" }, [
          el("span", { class: "small muted" }, "Place:"),
          ...placeableMachines.map((m) => {
            const owned = store.get().inventory[m.id] ?? 0;
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
            const owned = store.get().inventory[id] ?? 0;
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
      : el("p", { class: "muted small" }, "Craft a machine or chest to place it here."),
  ]);
}

function renderRoomGrid(room: Room): HTMLElement {
  return el(
    "div",
    { class: "room-grid" },
    room.cells.map((cell) =>
      cell.kind === "machine" ? renderMachineTile(cell) : renderChestTile(cell),
    ),
  );
}

function renderMachineTile(cell: PlacedMachine): HTMLElement {
  const m = MACHINES[cell.machineId];
  if (!m) return el("div");
  const s = store.get();
  const job = jobForInstance(s, cell.instanceId);
  const hasOutput = Object.values(cell.output).some((q) => q > 0);
  const status: "working" | "output" | "idle" = job
    ? "working"
    : hasOutput
      ? "output"
      : "idle";
  const isSelected = selectedInstanceId === cell.instanceId;

  const bufferTotal = inputBufferTotal(cell);
  const statusLabel =
    bufferTotal > 0 && status === "working"
      ? `Working (${bufferTotal} loaded)`
      : bufferTotal > 0
        ? `${tileStatusLabel(status)} · ${bufferTotal} loaded`
        : tileStatusLabel(status);

  const tile = el(
    "div",
    {
      class:
        "room-tile machine-tile" +
        (isSelected ? " selected" : "") +
        ` status-${status}`,
      title: `${m.name} — ${statusLabel} — click to open`,
      onclick: () => selectCell(cell.instanceId),
    },
    [
      el("span", { class: "tile-icon" }, m.icon),
      el("span", { class: "tile-name small" }, m.name),
      job
        ? el("div", { class: "job-progress tile-progress" }, [
            el("div", {
              class: "job-progress-fill",
              style: progressStyle(job.startedAt, job.endsAt),
              "data-start": String(job.startedAt),
              "data-end": String(job.endsAt),
            }),
          ])
        : null,
      el("span", { class: "tile-status small" }, statusLabel),
      bufferTotal > 0
        ? el(
            "span",
            {
              class: "tile-input-badge small",
              title: `${bufferTotal} / ${MACHINE_INPUT_CAP} items in input`,
            },
            `📥 ${bufferTotal}`,
          )
        : null,
    ],
  );
  return tile;
}

function tileStatusLabel(status: "working" | "output" | "idle"): string {
  if (status === "working") return "Working";
  if (status === "output") return "Output ready";
  return "Idle";
}

function progressStyle(start: number, end: number): string {
  const pct = Math.min(100, Math.max(0, ((gameNow() - start) / (end - start)) * 100));
  return `width: ${pct}%`;
}

function renderChestTile(cell: PlacedChest): HTMLElement {
  const it = ITEMS[cell.type]!;
  const cap = chestSlotCap(cell.type);
  const used = chestSlotsUsed(cell);
  const preserve = chestPreserveFactor(cell.type);
  const isSelected = selectedInstanceId === cell.instanceId;
  const titleSuffix = preserve > 1 ? ` — ×${preserve} shelf life` : "";

  return el(
    "div",
    {
      class: "room-tile chest-tile" + (isSelected ? " selected" : ""),
      title: `${it.name} — ${used}/${cap} slots${titleSuffix} — click to open`,
      onclick: () => selectCell(cell.instanceId),
    },
    [
      el("span", { class: "tile-icon" }, it.icon),
      el("span", { class: "tile-name small" }, it.name),
      el("span", { class: "tile-status small" }, `${used}/${cap}`),
    ],
  );
}

function renderMachineDetail(cell: PlacedMachine): HTMLElement {
  const s = store.get();
  const m = MACHINES[cell.machineId]!;
  const job = jobForInstance(s, cell.instanceId);
  const recipe = job ? RECIPES[job.recipeId] : null;
  const outputEntries = Object.entries(cell.output).filter(([, q]) => q > 0);

  // Recipes the player could plausibly run here right now. Off-season
  // recipes still show — greyed out, so the player can see what the plot
  // is for in winter — but obsolete-tool recipes and missing-input ones
  // stay hidden as before.
  const candidateRecipes = ALL_RECIPES.filter(
    (r) =>
      r.machine === cell.machineId &&
      (hasInputsAndTool(s, r) || (r.seasons && hasInputsAndToolIgnoringSeason(s, r))) &&
      !producesObsoleteCraft(s, r),
  );

  const inputEntries = Object.entries(cell.input ?? {}).filter(([, q]) => q > 0);
  const bufferTotal = inputBufferTotal(cell);
  const canPickup = !job && outputEntries.length === 0;
  const statusText = job
    ? bufferTotal > 0
      ? `Working (${bufferTotal} loaded)`
      : "Working"
    : outputEntries.length > 0
      ? "Output ready"
      : bufferTotal > 0
        ? `Loaded (${bufferTotal})`
        : "Idle";

  return el("div", { class: "cell-detail machine-detail" }, [
    el("div", { class: "detail-head" }, [
      el("span", { class: "icon big" }, m.icon),
      el("span", { class: "detail-title" }, m.name),
      el("span", { class: "detail-status small" }, statusText),
      bufferTotal > 0
        ? el(
            "button",
            {
              class: "unload-btn small",
              title: "Unload remaining inputs back to inventory",
              onclick: () => {
                if (unloadMachine(cell.instanceId)) save();
              },
            },
            "Unload",
          )
        : null,
      el(
        "button",
        {
          class: "pickup-btn small",
          disabled: !canPickup,
          title: canPickup
            ? bufferTotal > 0
              ? "Take this machine back into inventory (loaded items refund to you)"
              : "Take this machine back into inventory"
            : job
              ? "Wait for the current job to finish"
              : "Empty the output buffer first",
          onclick: () => {
            if (pickupMachine(cell.instanceId)) {
              selectedInstanceId = null;
              save();
            }
          },
        },
        "↑",
      ),
      el(
        "button",
        {
          class: "modal-close",
          title: "Close",
          onclick: () => selectCell(cell.instanceId),
        },
        "×",
      ),
    ]),
    job && recipe ? renderJobProgress(job.startedAt, job.endsAt, recipe) : null,
    inputEntries.length > 0
      ? el("div", { class: "detail-section" }, [
          el("h4", {}, `Input · ${bufferTotal} / ${MACHINE_INPUT_CAP}`),
          el(
            "div",
            { class: "input-row" },
            inputEntries.map(([id, qty]) => {
              const it = ITEMS[id]!;
              return el(
                "span",
                {
                  class: "input-chip",
                  title: `${qty}× ${it.name} loaded`,
                },
                [el("span", { class: "icon" }, it.icon), ` ${qty}`],
              );
            }),
          ),
        ])
      : null,
    outputEntries.length > 0
      ? el("div", { class: "detail-section" }, [
          el("h4", {}, "Output"),
          el(
            "div",
            { class: "output-row" },
            outputEntries.map(([id, qty]) => {
              const it = ITEMS[id]!;
              return el(
                "button",
                {
                  class: "output-btn",
                  title: `Take ${qty}× ${it.name}`,
                  onclick: () => {
                    if (takeMachineOutput(cell.instanceId, id)) save();
                  },
                },
                [
                  el("span", { class: "icon" }, it.icon),
                  ` ${qty}`,
                ],
              );
            }),
          ),
          el(
            "button",
            {
              class: "small take-all-btn",
              title: "Take everything",
              onclick: () => {
                if (takeMachineOutput(cell.instanceId)) save();
              },
            },
            "Take all",
          ),
        ])
      : null,
    el("div", { class: "detail-section" }, [
      el("h4", {}, "Recipes"),
      candidateRecipes.length === 0
        ? el(
            "p",
            { class: "muted small" },
            "No runnable recipes — gather more materials, or check the Recipe Index for what this machine can make.",
          )
        : el(
            "div",
            { class: "recipe-grid" },
            candidateRecipes.map((r) => renderInstanceRecipe(cell, r)),
          ),
    ]),
  ]);
}

function renderJobProgress(start: number, end: number, recipe: Recipe): HTMLElement {
  const out = recipe.outputs[0];
  const outItem = out ? ITEMS[out.item] : undefined;
  return el("div", { class: "detail-section job-running" }, [
    el("div", { class: "job-row" }, [
      el("span", { class: "icon" }, outItem?.icon ?? "⏳"),
      el(
        "span",
        { class: "job-label small" },
        out && outItem ? `Producing ${out.qty}× ${outItem.name}` : recipe.id,
      ),
      el("div", { class: "job-progress" }, [
        el("div", {
          class: "job-progress-fill",
          style: progressStyle(start, end),
          "data-start": String(start),
          "data-end": String(end),
        }),
      ]),
    ]),
  ]);
}

function renderInstanceRecipe(cell: PlacedMachine, r: Recipe): HTMLElement {
  const out = r.outputs[0]!;
  const outItem = ITEMS[out.item]!;
  const s = store.get();
  const toolOk = meetsToolReq(s, r.tool);
  const seasonOk = inSeason(s, r);
  const otherRecipeLoaded =
    !!cell.loadedRecipeId && cell.loadedRecipeId !== r.id;
  const loadable = maxLoadable(s, cell, r);
  const free = inputBufferFree(cell);
  const canLoadOne = toolOk && seasonOk && !otherRecipeLoaded && loadable >= 1;
  const showLoadAll = canLoadOne && loadable > 1;
  const seasonNote =
    !seasonOk && r.seasons
      ? `Plant in ${r.seasons.map((i) => SEASONS[i]).join("/")}`
      : null;
  const inputsOk = r.inputs.every(
    (i) => totalAvailableForInput(s, i) >= i.qty,
  );
  const primaryTitle = seasonNote
    ? seasonNote
    : otherRecipeLoaded
      ? `${MACHINES[r.machine]!.name} is loaded with another recipe — unload it first`
      : !toolOk && r.tool
        ? `Need ${r.tool.type} (tier ≥${r.tool.minTier})`
        : !inputsOk
          ? `Need more inputs`
          : free <= 0
            ? `Input buffer full (${MACHINE_INPUT_CAP}/${MACHINE_INPUT_CAP})`
            : `Load 1× ${outItem.name} into ${MACHINES[r.machine]!.name}`;

  return el("div", { class: "recipe-card" + (canLoadOne ? "" : " locked") }, [
    el(
      "button",
      {
        class: "recipe-craft-btn",
        disabled: !canLoadOne,
        title: primaryTitle,
        onclick: (ev: Event) => {
          const btn = ev.currentTarget as HTMLElement;
          btn.classList.add("flash");
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (craftAt(cell.instanceId, r.id, 1).ok) save();
            }, 60);
          });
        },
      },
      [
        el("span", { class: "icon big" }, outItem.icon),
        el("span", {}, `${out.qty}× ${outItem.name}`),
      ],
    ),
    showLoadAll
      ? el(
          "button",
          {
            class: "recipe-load-all-btn small",
            title: `Load ${loadable} batch${loadable === 1 ? "" : "es"} (limited by inputs and ${MACHINE_INPUT_CAP}-item buffer)`,
            onclick: (ev: Event) => {
              ev.stopPropagation();
              if (craftAt(cell.instanceId, r.id, loadable).ok) save();
            },
          },
          `+${loadable}`,
        )
      : null,
    el(
      "div",
      { class: "recipe-meta" },
      [
        ...r.inputs.map((i) => {
          if (isTagInput(i)) {
            const matches = itemsWithTag(i.tag);
            const first = matches[0];
            const detail = matches.map((m) => m.name).join(", ");
            return el(
              "span",
              {
                class: "ingredient tag-input",
                title: `Any ${i.tag} — ${detail}`,
                onclick: (ev: Event) => {
                  ev.stopPropagation();
                  openTagCallback(i.tag);
                },
              },
              [
                el("span", { class: "icon" }, first?.icon ?? "•"),
                ` ${i.qty} any ${i.tag}`,
              ],
            );
          }
          return el(
            "span",
            {
              class: "ingredient",
              title: `${ITEMS[i.item]!.name} — open in Recipe Index`,
              onclick: (ev: Event) => {
                ev.stopPropagation();
                openItemCallback(i.item);
              },
            },
            [
              el("span", { class: "icon" }, ITEMS[i.item]!.icon),
              ` ${i.qty}`,
            ],
          );
        }),
        r.tool
          ? (() => {
              const tier = bestToolTier(s, r.tool!.type);
              const short = tier < r.tool!.minTier;
              return el(
                "span",
                { class: "tool-req" + (short ? " short" : "") },
                `🛠 ${r.tool!.type} ≥${r.tool!.minTier}`,
              );
            })()
          : null,
        r.durationMs && r.durationMs > 0
          ? el("span", { class: "duration" }, `⏱ ${formatDuration(r.durationMs)}`)
          : null,
      ],
    ),
  ]);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`;
}

function renderChestDetail(roomId: string, chest: PlacedChest): HTMLElement {
  const s = store.get();
  const chestItem = ITEMS[chest.type]!;
  const cap = chestSlotCap(chest.type);
  const used = chestSlotsUsed(chest);
  const empty = used === 0;

  const stored = Object.entries(chest.contents)
    .filter(([, q]) => q > 0)
    .sort((a, b) => ITEMS[a[0]]!.name.localeCompare(ITEMS[b[0]]!.name));

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

  const preserve = chestPreserveFactor(chest.type);
  const statusText =
    preserve > 1
      ? `${used} / ${cap} slots · ×${preserve} shelf life`
      : `${used} / ${cap} slots`;

  return el("div", { class: "cell-detail chest-detail" }, [
    el("div", { class: "detail-head" }, [
      el("span", { class: "icon big" }, chestItem.icon),
      el("span", { class: "detail-title" }, chestItem.name),
      el("span", { class: "detail-status small" }, statusText),
      el(
        "button",
        {
          class: "pickup-btn small",
          disabled: !empty,
          title: empty
            ? "Take this chest back into inventory"
            : "Empty the chest before picking it up",
          onclick: () => {
            if (pickupChest(roomId, chest.instanceId)) {
              selectedInstanceId = null;
              save();
            }
          },
        },
        "↑",
      ),
      el(
        "button",
        {
          class: "modal-close",
          title: "Close",
          onclick: () => selectCell(chest.instanceId),
        },
        "×",
      ),
    ]),
    renderChestSlotGrid(roomId, chest, stored, cap),
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
                  if (depositToChest(roomId, chest.instanceId, id)) save();
                },
              },
              [el("span", { class: "icon" }, it.icon), ` ${qty}`],
            );
          }),
        ])
      : null,
  ]);
}

function renderChestSlotGrid(
  roomId: string,
  chest: PlacedChest,
  stored: [string, number][],
  cap: number,
): HTMLElement {
  if (stored.length === 0) {
    const grid = el("div", { class: "slot-grid", style: "--cols: 4" });
    for (let i = 0; i < cap; i++) grid.appendChild(el("div", { class: "slot empty" }));
    return grid;
  }
  const armed = isTrashMode();
  const fills: { id: ItemId; qty: number }[] = [];
  const totals = new Map<ItemId, number>();
  for (const [id, total] of stored) {
    totals.set(id, total);
    let remaining = total;
    const stack = stackSize(id);
    while (remaining > 0) {
      const take = Math.min(remaining, stack);
      fills.push({ id, qty: take });
      remaining -= take;
    }
  }
  const grid = el("div", { class: "slot-grid", style: "--cols: 4" });
  for (const f of fills) {
    const it = ITEMS[f.id]!;
    const total = totals.get(f.id)!;
    const slot = el(
      "div",
      {
        class: "slot",
        title: armed
          ? `Tap to discard ${total}× ${it.name}`
          : `${it.name} — ${f.qty}${total !== f.qty ? ` (of ${total})` : ""} — click to withdraw all, or drag to trash`,
        onclick: () => {
          if (isTrashMode()) {
            if (
              applyTrash({
                source: "chest",
                itemId: f.id,
                roomId,
                chestId: chest.instanceId,
              })
            )
              save();
            return;
          }
          if (withdrawFromChest(roomId, chest.instanceId, f.id)) save();
        },
      },
      [
        el("span", { class: "slot-icon" }, it.icon),
        el("span", { class: "slot-qty" }, String(f.qty)),
      ],
    );
    makeDraggable(slot, {
      source: "chest",
      itemId: f.id,
      roomId,
      chestId: chest.instanceId,
    });
    grid.appendChild(slot);
  }
  for (let i = fills.length; i < cap; i++) {
    grid.appendChild(el("div", { class: "slot empty" }));
  }
  return grid;
}
