import { store } from "../game/state";
import { clear, el } from "./dom";

export function mountLog(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    clear(root);
    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Log"),
        s.log.length === 0
          ? el("p", { class: "muted small" }, "Nothing has happened yet.")
          : el(
              "ul",
              { class: "log-list" },
              s.log.map((entry) => el("li", { class: "log-row small" }, entry.text)),
            ),
      ]),
    );
  };
  render();
  store.subscribe(render);
}
