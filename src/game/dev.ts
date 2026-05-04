import type { ItemId } from "../data/types";
import { load, reset, save, store } from "./state";

interface DevApi {
  give(item: ItemId, qty?: number): void;
  setInventory(items: Partial<Record<ItemId, number>>): void;
  dump(): unknown;
  copy(): void;
  reset(): void;
  save(): void;
  load(): void;
  wipe(): void;
}

declare global {
  interface Window {
    dev?: DevApi;
  }
}

export function installDevApi(): void {
  if (typeof window === "undefined") return;
  if (!new URLSearchParams(window.location.search).has("dev")) return;

  const api: DevApi = {
    give(item, qty = 1) {
      store.update((s) => {
        s.inventory[item] = (s.inventory[item] ?? 0) + qty;
      });
    },
    setInventory(items) {
      store.update((s) => {
        for (const [id, qty] of Object.entries(items)) {
          if (typeof qty === "number") s.inventory[id as ItemId] = qty;
        }
      });
    },
    dump() {
      const snap = store.get();
      console.log(snap);
      return snap;
    },
    copy() {
      const json = JSON.stringify(store.get(), null, 2);
      void navigator.clipboard?.writeText(json);
      console.info(`[dev] copied save to clipboard (${json.length} chars)`);
    },
    reset,
    save,
    load,
    wipe() {
      localStorage.removeItem("bootstrap-factory:save:v1");
      console.info("[dev] cleared save key. Reload to start fresh.");
    },
  };

  window.dev = api;
  console.info(
    "[dev] window.dev ready: give(id, qty), setInventory({id: qty}), dump(), copy(), reset(), save(), load(), wipe()",
  );
}
