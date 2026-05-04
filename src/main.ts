import { load, reset, save, store } from "./game/state";
import { el } from "./ui/dom";
import { mountCraft } from "./ui/craft";
import { mountGather } from "./ui/gather";
import { mountInventory } from "./ui/inventory";
import { mountRecipeIndex } from "./ui/recipe-index";

function buildShell(): void {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  const header = el("header", { class: "app-header" }, [
    el("h1", {}, "Bootstrap Factory"),
    el("span", { class: "tagline muted small" }, "early prototype — recipe index validation"),
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
  const right = el("section", { id: "right", class: "col col-right" });

  const inventory = el("div");
  gather.appendChild(el("div", { id: "gather-mount" }));
  gather.appendChild(inventory);

  const craft = el("div", { id: "craft-mount" });
  middle.appendChild(craft);

  const recipe = el("div", { id: "recipe-mount" });
  right.appendChild(recipe);

  const main = el("main", { class: "app-grid" }, [gather, middle, right]);
  app.appendChild(header);
  app.appendChild(main);

  mountGather(gather.querySelector("#gather-mount") as HTMLElement);
  mountInventory(inventory);
  mountCraft(craft);
  mountRecipeIndex(recipe);
}

function start(): void {
  load();
  buildShell();
  // Best-effort: persist on every state change.
  store.subscribe(() => save());
  window.addEventListener("beforeunload", save);
}

start();
