import { ITEMS } from "./data/items";
import { load, onGoToSeed, onSpoiled, reset, save, startTickLoop, store } from "./game/state";
import { el } from "./ui/dom";
import { mountCraft } from "./ui/craft";
import { mountGather } from "./ui/gather";
import { mountInventory } from "./ui/inventory";
import { createModal } from "./ui/modal";
import { mountQuestbook } from "./ui/questbook";
import { mountRecipeIndex, selectItem, selectTag } from "./ui/recipe-index";
import { mountRooms } from "./ui/rooms";
import { mountTimebar } from "./ui/timebar";
import { showToast, startMachineCraftedToasts } from "./ui/toast";

type TabId = "gather" | "workshop" | "rooms";

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
  mount: HTMLElement;
}

function buildShell(): void {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  const recipesModal = createModal("Recipe Index");
  mountRecipeIndex(recipesModal.body);

  const questbookModal = createModal("Questbook");
  mountQuestbook(questbookModal.body, {
    onOpenItem: (id) => {
      selectItem(id);
      questbookModal.close();
      recipesModal.open();
    },
  });

  // Top bar: title · timebar (day/season/time/stamina/sleep) · icon actions
  const timebarSlot = el("div", { class: "topbar-timebar" });

  const iconBtn = (icon: string, title: string, onclick: () => void) =>
    el("button", { class: "topbar-icon", title, onclick }, icon);

  const menu = el("details", { class: "topbar-menu" }, [
    el("summary", { class: "topbar-icon", title: "More" }, "⋯"),
    el("div", { class: "topbar-menu-items" }, [
      el(
        "button",
        {
          class: "menu-item danger",
          onclick: (ev: Event) => {
            (ev.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
            if (confirm("Reset all progress?")) reset();
          },
        },
        "Reset progress",
      ),
    ]),
  ]);

  const topbar = el("header", { class: "topbar" }, [
    el("div", { class: "topbar-title" }, "Bootstrap Factory"),
    timebarSlot,
    el("div", { class: "topbar-actions" }, [
      iconBtn("📜", "Quests (Q)", () => questbookModal.open()),
      iconBtn("📖", "Recipe index (R)", () => recipesModal.open()),
      menu,
    ]),
  ]);

  // Main shell: left inventory rail + tabbed main area
  const inventoryMount = el("div", { id: "inventory-mount" });

  const gatherMount = el("div", { id: "gather-mount", class: "tab-pane" });
  const craftMount = el("div", { id: "craft-mount", class: "tab-pane" });
  const roomsMount = el("div", { id: "rooms-mount", class: "tab-pane" });

  const tabs: TabDef[] = [
    { id: "gather", label: "Gather", icon: "🌿", mount: gatherMount },
    { id: "workshop", label: "Workshop", icon: "🔨", mount: craftMount },
    { id: "rooms", label: "Rooms", icon: "🏠", mount: roomsMount },
  ];

  const tabButtons: Record<TabId, HTMLButtonElement> = {} as Record<TabId, HTMLButtonElement>;
  let activeTab: TabId = "gather";
  const setTab = (id: TabId) => {
    activeTab = id;
    for (const t of tabs) {
      const isActive = t.id === id;
      t.mount.classList.toggle("active", isActive);
      tabButtons[t.id].classList.toggle("active", isActive);
      tabButtons[t.id].setAttribute("aria-selected", isActive ? "true" : "false");
    }
  };

  const tabStrip = el(
    "nav",
    { class: "tab-strip", role: "tablist" },
    tabs.map((t) => {
      const btn = el(
        "button",
        {
          class: "tab",
          role: "tab",
          title: t.label,
          onclick: () => setTab(t.id),
        },
        [el("span", { class: "tab-icon" }, t.icon), el("span", { class: "tab-label" }, t.label)],
      );
      tabButtons[t.id] = btn;
      return btn;
    }),
  );

  const rail = el("aside", { class: "rail" }, [inventoryMount]);
  const mainArea = el("section", { class: "main-area" }, [
    tabStrip,
    el("div", { class: "tab-panes" }, [gatherMount, craftMount, roomsMount]),
  ]);
  const shell = el("main", { class: "app-shell" }, [rail, mainArea]);

  app.appendChild(topbar);
  app.appendChild(shell);

  const openItemInRecipes = (id: Parameters<typeof selectItem>[0]) => {
    selectItem(id);
    recipesModal.open();
  };
  const openTagInRecipes = (tag: string) => {
    selectTag(tag);
    recipesModal.open();
  };

  mountTimebar(timebarSlot);
  mountInventory(inventoryMount);
  mountGather(gatherMount);
  mountCraft(craftMount, { onOpenItem: openItemInRecipes, onOpenTag: openTagInRecipes });
  mountRooms(roomsMount, { onOpenItem: openItemInRecipes, onOpenTag: openTagInRecipes });

  setTab(activeTab);

  document.addEventListener("keydown", (ev) => {
    const target = ev.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }
    if (ev.key === "r" || ev.key === "R") {
      ev.preventDefault();
      if (recipesModal.isOpen()) recipesModal.close();
      else recipesModal.open();
    } else if (ev.key === "q" || ev.key === "Q") {
      ev.preventDefault();
      if (questbookModal.isOpen()) questbookModal.close();
      else questbookModal.open();
    }
  });
}

function start(): void {
  load();
  buildShell();
  startMachineCraftedToasts();
  onSpoiled((ids) => {
    const names = ids.map((id) => ITEMS[id]?.name ?? id).join(", ");
    showToast(`Spoiled: ${names}. Build a drying rack to preserve food.`, "🪰");
  });
  onGoToSeed((ids) => {
    const names = ids.map((id) => ITEMS[id]?.name ?? id).join(", ");
    showToast(`Plot went to seed: ${names}. Take harvests within two days.`, "🌾");
  });
  // Best-effort: persist on every state change.
  store.subscribe(() => save());
  window.addEventListener("beforeunload", save);
  startTickLoop();
}

start();
