import { load, reset, save, startTickLoop, store } from "./game/state";
import { el } from "./ui/dom";
import { mountCraft } from "./ui/craft";
import { mountGather } from "./ui/gather";
import { mountInventory } from "./ui/inventory";
import { createModal } from "./ui/modal";
import { mountQuestbook } from "./ui/questbook";
import { mountRecipeIndex } from "./ui/recipe-index";
import { mountRooms } from "./ui/rooms";

function buildShell(): void {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  const recipesModal = createModal("Recipe Index");
  mountRecipeIndex(recipesModal.body);

  const questbookModal = createModal("Questbook");
  mountQuestbook(questbookModal.body);

  const recipesBtn = el(
    "button",
    {
      class: "header-btn",
      title: "Open recipe index (R)",
      onclick: () => recipesModal.open(),
    },
    "📖 Recipes",
  );

  const questbookBtn = el(
    "button",
    {
      class: "header-btn",
      title: "Open questbook (Q)",
      onclick: () => questbookModal.open(),
    },
    "📜 Quests",
  );

  const header = el("header", { class: "app-header" }, [
    el("h1", {}, "Bootstrap Factory"),
    el("span", { class: "tagline muted small" }, "early prototype — recipe index validation"),
    questbookBtn,
    recipesBtn,
    el(
      "button",
      {
        class: "reset-btn",
        title: "Wipe save and start over",
        onclick: () => {
          if (confirm("Reset all progress?")) reset();
        },
      },
      "Reset",
    ),
  ]);

  const gather = el("section", { id: "gather", class: "col col-left" });
  const middle = el("section", { id: "middle", class: "col col-mid" });

  const inventory = el("div");
  gather.appendChild(el("div", { id: "gather-mount" }));
  gather.appendChild(inventory);

  const rooms = el("div", { id: "rooms-mount" });
  const craft = el("div", { id: "craft-mount" });
  middle.appendChild(rooms);
  middle.appendChild(craft);

  const main = el("main", { class: "app-grid" }, [gather, middle]);
  app.appendChild(header);
  app.appendChild(main);

  mountGather(gather.querySelector("#gather-mount") as HTMLElement);
  mountInventory(inventory);
  mountRooms(rooms);
  mountCraft(craft);

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
  // Best-effort: persist on every state change.
  store.subscribe(() => save());
  window.addEventListener("beforeunload", save);
  startTickLoop();
}

start();
