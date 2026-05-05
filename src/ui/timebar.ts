import { currentSeason, DAYS_PER_SEASON, sleep, store } from "../game/state";
import { clear, el } from "./dom";

const SEASON_ICON: Record<string, string> = {
  Spring: "🌱",
  Summer: "☀️",
  Autumn: "🍂",
  Winter: "❄️",
};

/** Format minutes as "Xh Ym" (omits the zero part). */
function formatHours(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function mountTimebar(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    const dayHoursLeft = Math.max(0, s.dayLength - s.worldClock);
    const budgetPct = Math.round((s.timeBudget / s.dayLength) * 100);
    const dayPct = Math.round((s.worldClock / s.dayLength) * 100);
    const canSleep = !s.actionJob;
    const season = currentSeason(s);
    const dayInSeason = ((s.dayNumber - 1) % DAYS_PER_SEASON) + 1;
    clear(root);
    root.appendChild(
      el("div", { class: "panel timebar" }, [
        el("div", { class: "timebar-head" }, [
          el("h2", {}, `Day ${s.dayNumber}`),
          el(
            "span",
            {
              class: "season-chip small",
              title: `${season}, day ${dayInSeason} of ${DAYS_PER_SEASON}. Seasons shape what the land yields.`,
            },
            `${SEASON_ICON[season] ?? ""} ${season}`,
          ),
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
