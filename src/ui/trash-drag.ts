import {
  save,
  trashFromChest,
  trashFromFloor,
  trashFromInventory,
} from "../game/state";
import type { ItemId } from "../data/types";

export type TrashSource =
  | { source: "inventory"; itemId: ItemId }
  | { source: "floor"; itemId: ItemId }
  | { source: "chest"; itemId: ItemId; roomId: string; chestId: string };

const MIME = "application/x-bf-trash";

let active: TrashSource | null = null;
let trashMode = false;
const trashModeListeners = new Set<(on: boolean) => void>();

export function isTrashMode(): boolean {
  return trashMode;
}

export function setTrashMode(on: boolean): void {
  if (trashMode === on) return;
  trashMode = on;
  document.body.classList.toggle("trash-armed", on);
  for (const cb of trashModeListeners) cb(on);
}

export function toggleTrashMode(): void {
  setTrashMode(!trashMode);
}

export function subscribeTrashMode(cb: (on: boolean) => void): () => void {
  trashModeListeners.add(cb);
  return () => trashModeListeners.delete(cb);
}

export function makeDraggable(node: HTMLElement, payload: TrashSource): void {
  node.setAttribute("draggable", "true");
  node.addEventListener("dragstart", (ev) => {
    active = payload;
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData(MIME, JSON.stringify(payload));
    }
    document.body.classList.add("trash-dragging");
  });
  node.addEventListener("dragend", () => {
    active = null;
    document.body.classList.remove("trash-dragging");
  });
}

export function readDrop(ev: DragEvent): TrashSource | null {
  const raw = ev.dataTransfer?.getData(MIME);
  if (raw) {
    try {
      return JSON.parse(raw) as TrashSource;
    } catch {
      // fall through
    }
  }
  return active;
}

export function applyTrash(payload: TrashSource): boolean {
  if (payload.source === "inventory") return trashFromInventory(payload.itemId);
  if (payload.source === "floor") return trashFromFloor(payload.itemId);
  return trashFromChest(payload.roomId, payload.chestId, payload.itemId);
}

export function wireTrashTarget(node: HTMLElement): void {
  node.addEventListener("click", () => {
    toggleTrashMode();
  });
  node.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    node.classList.add("trash-over");
  });
  node.addEventListener("dragenter", (ev) => {
    ev.preventDefault();
    node.classList.add("trash-over");
  });
  node.addEventListener("dragleave", () => {
    node.classList.remove("trash-over");
  });
  node.addEventListener("drop", (ev) => {
    ev.preventDefault();
    node.classList.remove("trash-over");
    const payload = readDrop(ev);
    if (!payload) return;
    if (applyTrash(payload)) save();
  });
}
