import { el } from "./dom";

interface Modal {
  root: HTMLElement;
  body: HTMLElement;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

const openStack: Modal[] = [];

function onKeyDown(ev: KeyboardEvent): void {
  if (ev.key === "Escape" && openStack.length > 0) {
    openStack[openStack.length - 1]!.close();
  }
}

document.addEventListener("keydown", onKeyDown);

export function createModal(title: string): Modal {
  const body = el("div", { class: "modal-body" });
  const closeBtn = el(
    "button",
    { class: "modal-close", title: "Close (Esc)", onclick: () => modal.close() },
    "✕",
  );
  const card = el("div", { class: "modal-card", role: "dialog", "aria-modal": "true" }, [
    el("div", { class: "modal-head" }, [el("h2", {}, title), closeBtn]),
    body,
  ]);
  const root = el(
    "div",
    {
      class: "modal-backdrop hidden",
      onclick: (ev: Event) => {
        if (ev.target === root) modal.close();
      },
    },
    [card],
  );
  document.body.appendChild(root);

  const modal: Modal = {
    root,
    body,
    open: () => {
      if (modal.isOpen()) return;
      root.classList.remove("hidden");
      openStack.push(modal);
    },
    close: () => {
      if (!modal.isOpen()) return;
      root.classList.add("hidden");
      const idx = openStack.lastIndexOf(modal);
      if (idx >= 0) openStack.splice(idx, 1);
    },
    isOpen: () => !root.classList.contains("hidden"),
  };
  return modal;
}
