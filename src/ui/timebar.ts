import { currentSeason, DAYS_PER_SEASON, sleep, store } from "../game/state";
import { clear, el } from "./dom";

const SEASON_ICON: Record<string, string> = {
  Spring: "🌱",
  Summer: "☀️",
  Autumn: "🍂",
  Winter: "❄️",
};

interface TimeOfDay {
  label: string;
  icon: string;
}

function timeOfDay(pct: number): TimeOfDay {
  if (pct < 0.25) return { label: "Morning", icon: "🌅" };
  if (pct < 0.55) return { label: "Midday", icon: "☀️" };
  if (pct < 0.8) return { label: "Afternoon", icon: "🌤️" };
  return { label: "Evening", icon: "🌆" };
}

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
    const stamPct = Math.round((s.timeBudget / s.dayLength) * 100);
    const dayPct = Math.round((s.worldClock / s.dayLength) * 100);
    const canSleep = !s.actionJob;
    const season = currentSeason(s);
    const dayInSeason = ((s.dayNumber - 1) % DAYS_PER_SEASON) + 1;
    const tod = timeOfDay(s.worldClock / s.dayLength);
    clear(root);
    root.appendChild(
      el("div", { class: "timebar" }, [
        el("div", { class: "tb-day" }, [
          el("span", { class: "tb-day-num" }, `Day ${s.dayNumber}`),
          el(
            "span",
            {
              class: "tb-season",
              title: `${season}, day ${dayInSeason} of ${DAYS_PER_SEASON}. Seasons shape what the land yields.`,
            },
            `${SEASON_ICON[season] ?? ""} ${season}`,
          ),
        ]),
        el("div", { class: "tb-meter-block", title: "Time of day — sleep to start a new day" }, [
          el("div", { class: "tb-meter-head" }, [
            el("span", { class: "tb-meter-icon" }, tod.icon),
            el("span", { class: "tb-meter-label" }, tod.label),
            el("span", { class: "tb-meter-value" }, `${formatHours(dayHoursLeft)} left`),
          ]),
          el("div", { class: "meter" }, [
            el("div", { class: "meter-fill day-fill", style: `width: ${dayPct}%` }),
          ]),
        ]),
        el(
          "div",
          {
            class: "tb-meter-block",
            title: "Stamina — depleted by actions, restored by eating",
          },
          [
            el("div", { class: "tb-meter-head" }, [
              el("span", { class: "tb-meter-icon" }, "🍞"),
              el("span", { class: "tb-meter-label" }, "Stamina"),
              el("span", { class: "tb-meter-value" }, `≈ ${formatHours(s.timeBudget)}`),
            ]),
            el("div", { class: "meter" }, [
              el("div", { class: "meter-fill stamina-fill", style: `width: ${stamPct}%` }),
            ]),
          ],
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
    );
  };
  render();
  store.subscribe(render);
}
