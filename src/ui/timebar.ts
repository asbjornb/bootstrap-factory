import { sleep, store } from "../game/state";
import { clear, el } from "./dom";

/** Format minutes as a coarse "h" reading per the spec ("don't show raw minutes"). */
function formatHours(minutes: number): string {
  if (minutes <= 0) return "0 h";
  const h = minutes / 60;
  if (h < 1) return "<1 h";
  if (h < 10) return `${h.toFixed(1).replace(/\.0$/, "")} h`;
  return `${Math.round(h)} h`;
}

export function mountTimebar(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    const dayHoursLeft = Math.max(0, s.dayLength - s.worldClock);
    const budgetPct = Math.round((s.timeBudget / s.dayLength) * 100);
    const dayPct = Math.round((s.worldClock / s.dayLength) * 100);
    const canSleep = !s.actionJob;
    clear(root);
    root.appendChild(
      el("div", { class: "panel timebar" }, [
        el("div", { class: "timebar-head" }, [
          el("h2", {}, `Day ${s.dayNumber}`),
          el(
            "button",
            {
              class: "sleep-btn",
              disabled: !canSleep,
              title: canSleep
                ? "Sleep until dawn. Resets the day; machines keep working."
                : "Finish your current action first.",
              onclick: () => {
                sleep();
              },
            },
            "💤 Sleep",
          ),
        ]),
        el("div", { class: "meter-row" }, [
          el("span", { class: "meter-label small" }, "Energy"),
          el("div", { class: "meter", title: `Time-budget remaining today` }, [
            el("div", {
              class: "meter-fill energy-fill",
              style: `width: ${budgetPct}%`,
            }),
          ]),
          el(
            "span",
            { class: "meter-value small", title: "Hours of work you can still afford" },
            `≈ ${formatHours(s.timeBudget)}`,
          ),
        ]),
        el("div", { class: "meter-row" }, [
          el("span", { class: "meter-label small" }, "Day"),
          el("div", { class: "meter", title: "How much of the in-world day you've burned" }, [
            el("div", {
              class: "meter-fill day-fill",
              style: `width: ${dayPct}%`,
            }),
          ]),
          el(
            "span",
            { class: "meter-value small", title: "Hours left before nightfall" },
            `${formatHours(dayHoursLeft)} left`,
          ),
        ]),
      ]),
    );
  };
  render();
  store.subscribe(render);
}
