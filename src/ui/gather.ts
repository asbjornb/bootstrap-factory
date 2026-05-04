import { ALL_GATHER_ACTIONS } from "../data/gather";
import { ITEMS } from "../data/items";
import { bestToolTier, gather, gatherDuration, onTick, store } from "../game/state";
import { clear, el } from "./dom";

export function mountGather(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    const active = s.gatherJob;
    clear(root);
    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Gather"),
        el(
          "div",
          { class: "gather-grid" },
          ALL_GATHER_ACTIONS.map((a) => {
            const lockedDrops = a.drops.filter(
              (d) => d.requiresTool && bestToolTier(s, d.requiresTool.type) < d.requiresTool.minTier,
            );
            const dur = gatherDuration(s, a);
            const isThisActive = active?.gatherId === a.id;
            const otherBusy = active !== null && !isThisActive;
            return el("div", { class: "gather-card" }, [
              el(
                "button",
                {
                  class: "gather-btn",
                  disabled: active !== null,
                  title: otherBusy
                    ? "Another gather action is in progress"
                    : `Takes ${formatDuration(dur)}`,
                  onclick: (ev: Event) => {
                    const btn = ev.currentTarget as HTMLElement;
                    btn.classList.add("flash");
                    requestAnimationFrame(() => {
                      setTimeout(() => gather(a.id), 60);
                    });
                  },
                },
                [el("span", { class: "icon big" }, a.icon), el("span", {}, a.name)],
              ),
              isThisActive
                ? el("div", { class: "gather-progress" }, [
                    el("div", {
                      class: "gather-progress-fill",
                      style: `width: ${progressPct(active.startedAt, active.endsAt)}%`,
                      "data-start": String(active.startedAt),
                      "data-end": String(active.endsAt),
                    }),
                  ])
                : el("p", { class: "muted small" }, `⏱ ${formatDuration(dur)}`),
              el("p", { class: "muted small" }, a.description ?? ""),
              lockedDrops.length > 0
                ? el(
                    "p",
                    { class: "small" },
                    `Better tools could yield: ${lockedDrops
                      .map((d) => ITEMS[d.item]!.name)
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .join(", ")}.`,
                  )
                : null,
            ]);
          }),
        ),
      ]),
    );
  };
  render();
  store.subscribe(render);
  onTick(() => {
    for (const bar of root.querySelectorAll<HTMLElement>(".gather-progress-fill")) {
      const start = Number(bar.dataset.start);
      const end = Number(bar.dataset.end);
      if (!start || !end) continue;
      bar.style.width = `${progressPct(start, end)}%`;
    }
  });
}

function progressPct(start: number, end: number): number {
  return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`;
}
