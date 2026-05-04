import { questsForDisplay, store } from "../game/state";
import type { Quest } from "../data/types";
import { clear, el } from "./dom";

export function mountQuestbook(root: HTMLElement): void {
  const render = () => {
    const { active, completed } = questsForDisplay(store.get());
    clear(root);
    root.appendChild(
      el("div", { class: "questbook" }, [
        el(
          "p",
          { class: "muted small qb-intro" },
          "Optional. The questbook collects hints toward progression milestones — there are no rewards for finishing one. Ignore them and play your own way if you'd rather.",
        ),
        renderSection("Active", active, false),
        renderSection(`Completed (${completed.length})`, completed, true),
      ]),
    );
  };
  render();
  store.subscribe(render);
}

function renderSection(title: string, quests: Quest[], done: boolean): HTMLElement {
  return el("div", { class: "qb-section" }, [
    el("h3", {}, title),
    quests.length === 0
      ? el(
          "p",
          { class: "muted small" },
          done ? "Nothing finished yet." : "No active hints right now — keep exploring.",
        )
      : el(
          "ul",
          { class: "qb-list" },
          quests.map((q) => renderQuest(q, done)),
        ),
  ]);
}

function renderQuest(q: Quest, done: boolean): HTMLElement {
  return el("li", { class: "qb-quest" + (done ? " done" : "") }, [
    el("span", { class: "qb-check", "aria-hidden": "true" }, done ? "☑" : "☐"),
    el("div", { class: "qb-body" }, [
      el("div", { class: "qb-title" }, q.title),
      el("div", { class: "qb-desc small muted" }, q.description),
    ]),
  ]);
}
