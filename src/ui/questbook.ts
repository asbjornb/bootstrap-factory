import { ITEMS } from "../data/items";
import { questsForTree, store, type QuestNode } from "../game/state";
import type { ItemId } from "../data/types";
import { clear, el } from "./dom";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface QuestbookOptions {
  /** Called when a required-item chip is clicked. Should focus the item in the recipe index. */
  onOpenItem?: (id: ItemId) => void;
}

export function mountQuestbook(root: HTMLElement, opts: QuestbookOptions = {}): void {
  let resizeObserver: ResizeObserver | null = null;

  const render = () => {
    const nodes = questsForTree(store.get());
    const columns = layoutColumns(nodes);

    clear(root);
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    const completedCount = nodes.filter((n) => n.status === "done").length;
    const totalCount = nodes.length;

    const cardEls = new Map<string, HTMLElement>();
    const edgesSvg = document.createElementNS(SVG_NS, "svg");
    edgesSvg.setAttribute("class", "qb-tree-edges");

    const treeEl = el(
      "div",
      { class: "qb-tree" },
      [
        edgesSvg as unknown as HTMLElement,
        ...columns.map((col, i) =>
          el(
            "div",
            { class: "qb-tree-column", "data-tier": String(i) },
            col.map((n) => {
              const card = renderNode(n, opts);
              cardEls.set(n.quest.id, card);
              return card;
            }),
          ),
        ),
      ],
    );

    root.appendChild(
      el("div", { class: "questbook" }, [
        el(
          "p",
          { class: "muted small qb-intro" },
          `Optional. The questbook collects hints toward progression milestones — there are no rewards for finishing one. Ignore them and play your own way if you'd rather. (${completedCount}/${totalCount} complete)`,
        ),
        treeEl,
      ]),
    );

    const draw = () => drawEdges(treeEl, edgesSvg, nodes, cardEls);
    requestAnimationFrame(draw);
    resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(treeEl);
  };

  render();
  store.subscribe(render);
}

/** Group nodes by depth and order each column to minimise edge crossings. */
function layoutColumns(nodes: QuestNode[]): QuestNode[][] {
  const columns: QuestNode[][] = [];
  for (const n of nodes) {
    while (columns.length <= n.depth) columns.push([]);
    columns[n.depth]!.push(n);
  }
  for (let c = 0; c < columns.length; c++) {
    if (c === 0) {
      columns[c]!.sort((a, b) => a.order - b.order);
      continue;
    }
    const prevPos = new Map<string, number>();
    columns[c - 1]!.forEach((n, i) => prevPos.set(n.quest.id, i));
    columns[c]!.sort((a, b) => {
      const ap = a.quest.prereq?.[0];
      const bp = b.quest.prereq?.[0];
      const ai = ap !== undefined ? (prevPos.get(ap) ?? 0) : 0;
      const bi = bp !== undefined ? (prevPos.get(bp) ?? 0) : 0;
      if (ai !== bi) return ai - bi;
      return a.order - b.order;
    });
  }
  return columns;
}

function renderNode(n: QuestNode, opts: QuestbookOptions): HTMLElement {
  const q = n.quest;
  const kindLabel = q.kind === "progression" ? "Progression" : "Utility";
  const required = (q.requires ?? []).filter((id) => ITEMS[id]);
  const mark = n.status === "done" ? "☑" : n.status === "locked" ? "🔒" : "☐";
  return el(
    "div",
    {
      class: `qb-node qb-${n.status}`,
      "data-quest-id": q.id,
    },
    [
      el("div", { class: "qb-head" }, [
        el("span", { class: "qb-check", "aria-hidden": "true" }, mark),
        el("div", { class: "qb-title" }, q.title),
        el("span", { class: `qb-kind qb-kind-${q.kind}` }, kindLabel),
      ]),
      el("div", { class: "qb-desc small muted" }, q.description),
      el("div", { class: "qb-benefit small" }, [
        el("span", { class: "qb-benefit-label" }, "Reward: "),
        el("span", {}, q.benefit),
      ]),
      required.length > 0
        ? el("div", { class: "qb-requires small" }, [
            el("span", { class: "qb-requires-label" }, "Required: "),
            ...required.map((id) => requiredChip(id, opts)),
          ])
        : null,
    ],
  );
}

function requiredChip(id: ItemId, opts: QuestbookOptions): HTMLElement {
  const it = ITEMS[id]!;
  return el(
    "button",
    {
      class: "stack-chip qb-required-chip",
      title: `${it.name} — open in recipe index`,
      onclick: () => opts.onOpenItem?.(id),
    },
    [el("span", { class: "icon" }, it.icon), el("span", {}, ` ${it.name}`)],
  );
}

function drawEdges(
  treeEl: HTMLElement,
  svg: SVGElement,
  nodes: QuestNode[],
  cardEls: Map<string, HTMLElement>,
): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const treeRect = treeEl.getBoundingClientRect();
  const w = treeEl.scrollWidth;
  const h = treeEl.scrollHeight;
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const nodeById = new Map(nodes.map((n) => [n.quest.id, n]));

  for (const n of nodes) {
    const childCard = cardEls.get(n.quest.id);
    if (!childCard) continue;
    for (const pid of n.quest.prereq ?? []) {
      const parentCard = cardEls.get(pid);
      const parent = nodeById.get(pid);
      if (!parentCard || !parent) continue;

      const pr = parentCard.getBoundingClientRect();
      const cr = childCard.getBoundingClientRect();
      const x1 = pr.right - treeRect.left + treeEl.scrollLeft;
      const y1 = pr.top + pr.height / 2 - treeRect.top + treeEl.scrollTop;
      const x2 = cr.left - treeRect.left + treeEl.scrollLeft;
      const y2 = cr.top + cr.height / 2 - treeRect.top + treeEl.scrollTop;
      const dx = Math.max(40, (x2 - x1) * 0.5);

      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute(
        "d",
        `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
      );
      let cls = "qb-edge";
      if (n.status === "done") cls += " qb-edge-done";
      else if (parent.status === "done") cls += " qb-edge-unlocked";
      else cls += " qb-edge-locked";
      path.setAttribute("class", cls);
      svg.appendChild(path);
    }
  }
}
