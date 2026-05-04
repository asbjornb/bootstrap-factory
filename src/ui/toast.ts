import { MACHINES } from "../data/machines";
import { store } from "../game/state";
import type { MachineId } from "../data/types";
import { el } from "./dom";

const TOAST_MS = 6000;

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container && container.isConnected) return container;
  container = el("div", { class: "toast-stack", "aria-live": "polite" });
  document.body.appendChild(container);
  return container;
}

export function showToast(message: string, icon?: string): void {
  const root = ensureContainer();
  const toast = el("div", { class: "toast", role: "status" }, [
    icon ? el("span", { class: "toast-icon" }, icon) : null,
    el("span", { class: "toast-msg" }, message),
    el(
      "button",
      {
        class: "toast-close",
        "aria-label": "Dismiss",
        onclick: () => dismiss(toast),
      },
      "×",
    ),
  ]);
  root.appendChild(toast);
  // Trigger CSS enter transition.
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => dismiss(toast), TOAST_MS);
}

function dismiss(toast: HTMLElement): void {
  if (!toast.isConnected) return;
  toast.classList.remove("show");
  toast.classList.add("leave");
  setTimeout(() => toast.remove(), 250);
}

/**
 * Fire a single one-time toast the first time the player ever finishes
 * crafting any machine, to teach the placement → click-to-craft flow.
 * If the loaded save already has machines built, the hint is skipped.
 */
export function startMachineCraftedToasts(): void {
  if (Object.keys(store.get().everBuilt).length > 0) return;
  const unsubscribe = store.subscribe((s) => {
    const ids = Object.keys(s.everBuilt) as MachineId[];
    if (ids.length === 0) return;
    const m = MACHINES[ids[0]!];
    unsubscribe();
    if (!m) return;
    showToast(
      `${m.name} crafted! Place it in a room, then click it to load a recipe and craft.`,
      m.icon,
    );
  });
}
