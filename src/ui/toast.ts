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
 * Fire a one-time toast the first time each machine appears in `everBuilt`,
 * to teach the placement → click-to-craft flow. Already-built machines from
 * a loaded save are silently snapshot at start so reloads don't re-fire.
 */
export function startMachineCraftedToasts(): void {
  const seen = new Set<MachineId>(
    Object.keys(store.get().everBuilt) as MachineId[],
  );
  store.subscribe((s) => {
    for (const id of Object.keys(s.everBuilt) as MachineId[]) {
      if (seen.has(id)) continue;
      seen.add(id);
      const m = MACHINES[id];
      if (!m) continue;
      showToast(
        `${m.name} crafted! Place it in a room, then click it to load a recipe and craft.`,
        m.icon,
      );
    }
  });
}
