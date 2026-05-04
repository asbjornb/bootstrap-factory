import { ALL_BIOMES } from "../data/biomes";
import { ALL_GATHER_ACTIONS } from "../data/gather";
import { ITEMS } from "../data/items";
import { MACHINES } from "../data/machines";
import { ALL_NODES } from "../data/nodes";
import {
  bestToolTier,
  exploreBiome,
  gather,
  gatherDuration,
  harvestNode,
  hasUndiscoveredBiomes,
  nodeHarvestDuration,
  onTick,
  store,
  wander,
} from "../game/state";
import { WANDER_DURATION_MS } from "../data/wander";
import type { Biome, GatherAction, ResourceNode } from "../data/types";
import { clear, el } from "./dom";

export function mountGather(root: HTMLElement): void {
  const render = () => {
    const s = store.get();
    const job = s.actionJob;
    const busy = job !== null;
    clear(root);

    const cards: (HTMLElement | null)[] = [];

    // Always-on gather actions (currently empty by design).
    for (const a of ALL_GATHER_ACTIONS) {
      cards.push(renderGatherCard(a, s, busy, job));
    }

    // Biome explore + currently-charged node cards (only for discovered biomes).
    for (const biome of ALL_BIOMES) {
      if (!s.discoveredBiomes[biome.id]) continue;
      cards.push(renderExploreCard(biome, s, busy, job));
      for (const node of ALL_NODES) {
        if (node.biome !== biome.id) continue;
        const charges = s.nodeCharges[node.id] ?? 0;
        if (charges <= 0) continue;
        cards.push(renderNodeCard(node, charges, s, busy, job));
      }
    }

    // Wander to discover new biomes — hidden once everything is found.
    if (hasUndiscoveredBiomes(s)) {
      cards.push(renderWanderCard(busy, job));
    }

    root.appendChild(
      el("div", { class: "panel" }, [
        el("h2", {}, "Gather"),
        s.lastExploreMessage
          ? el("p", { class: "small explore-msg" }, s.lastExploreMessage)
          : null,
        el("div", { class: "gather-grid" }, cards),
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

function renderGatherCard(
  a: GatherAction,
  s: ReturnType<typeof store.get>,
  busy: boolean,
  job: ReturnType<typeof store.get>["actionJob"],
): HTMLElement {
  const toolLocked = new Set<string>();
  const machineLocked = new Map<string, Set<string>>();
  for (const d of a.drops) {
    const itemName = ITEMS[d.item]!.name;
    if (d.requiresTool && bestToolTier(s, d.requiresTool.type) < d.requiresTool.minTier) {
      toolLocked.add(itemName);
    }
    const gate = d.requiresMachineEverBuilt;
    if (gate && !s.everBuilt[gate]) {
      if (!machineLocked.has(gate)) machineLocked.set(gate, new Set());
      machineLocked.get(gate)!.add(itemName);
    }
  }
  const dur = gatherDuration(s, a);
  const isThisActive = job?.kind === "gather" && job.gatherId === a.id;
  return el("div", { class: "gather-card" }, [
    el(
      "button",
      {
        class: "gather-btn",
        disabled: busy,
        title:
          busy && !isThisActive
            ? "Another action is in progress"
            : `Takes ${formatDuration(dur)}`,
        onclick: (ev: Event) => flashThen(ev, () => gather(a.id)),
      },
      [el("span", { class: "icon big" }, a.icon), el("span", {}, a.name)],
    ),
    isThisActive
      ? renderProgressBar(job!.startedAt, job!.endsAt)
      : el("p", { class: "muted small" }, `⏱ ${formatDuration(dur)}`),
    el("p", { class: "muted small" }, a.description ?? ""),
    ...Array.from(machineLocked.entries()).map(([machineId, items]) =>
      el(
        "p",
        { class: "small" },
        `Build a ${MACHINES[machineId]?.name ?? machineId} and you'll start collecting: ${Array.from(items).join(", ")}.`,
      ),
    ),
    toolLocked.size > 0
      ? el(
          "p",
          { class: "small" },
          `Better tools could yield more: ${Array.from(toolLocked).join(", ")}.`,
        )
      : null,
  ]);
}

function renderExploreCard(
  biome: Biome,
  _s: ReturnType<typeof store.get>,
  busy: boolean,
  job: ReturnType<typeof store.get>["actionJob"],
): HTMLElement {
  const dur = biome.exploreDurationMs;
  const isThisActive = job?.kind === "explore" && job.biomeId === biome.id;
  return el("div", { class: "gather-card explore-card" }, [
    el(
      "button",
      {
        class: "gather-btn",
        disabled: busy,
        title:
          busy && !isThisActive
            ? "Another action is in progress"
            : `Takes ${formatDuration(dur)}`,
        onclick: (ev: Event) => flashThen(ev, () => exploreBiome(biome.id)),
      },
      [
        el("span", { class: "icon big" }, biome.icon),
        el("span", {}, `Explore ${biome.name}`),
      ],
    ),
    isThisActive
      ? renderProgressBar(job!.startedAt, job!.endsAt)
      : el("p", { class: "muted small" }, `⏱ ${formatDuration(dur)}`),
    el("p", { class: "muted small" }, biome.description ?? ""),
  ]);
}

function renderWanderCard(
  busy: boolean,
  job: ReturnType<typeof store.get>["actionJob"],
): HTMLElement {
  const dur = WANDER_DURATION_MS;
  const isThisActive = job?.kind === "wander";
  return el("div", { class: "gather-card explore-card" }, [
    el(
      "button",
      {
        class: "gather-btn",
        disabled: busy,
        title:
          busy && !isThisActive
            ? "Another action is in progress"
            : `Takes ${formatDuration(dur)}`,
        onclick: (ev: Event) => flashThen(ev, () => wander()),
      },
      [el("span", { class: "icon big" }, "🧭"), el("span", {}, "Wander Further")],
    ),
    isThisActive
      ? renderProgressBar(job!.startedAt, job!.endsAt)
      : el("p", { class: "muted small" }, `⏱ ${formatDuration(dur)}`),
    el(
      "p",
      { class: "muted small" },
      "Strike out beyond the familiar woods. There must be other places worth knowing.",
    ),
  ]);
}

function renderNodeCard(
  node: ResourceNode,
  charges: number,
  s: ReturnType<typeof store.get>,
  busy: boolean,
  job: ReturnType<typeof store.get>["actionJob"],
): HTMLElement {
  const dur = nodeHarvestDuration(s, node);
  const isThisActive = job?.kind === "harvest" && job.nodeId === node.id;
  const toolOk = !node.requiresTool || bestToolTier(s, node.requiresTool.type) >= node.requiresTool.minTier;
  const disabled = busy || !toolOk;
  const title = !toolOk
    ? `Needs ${node.requiresTool!.type} (tier ≥ ${node.requiresTool!.minTier})`
    : busy && !isThisActive
      ? "Another action is in progress"
      : `Takes ${formatDuration(dur)} · ${charges} charge${charges === 1 ? "" : "s"} left`;

  const toolLocked = new Set<string>();
  for (const d of node.drops) {
    if (d.requiresTool && bestToolTier(s, d.requiresTool.type) < d.requiresTool.minTier) {
      toolLocked.add(ITEMS[d.item]!.name);
    }
  }

  return el("div", { class: "gather-card node-card" }, [
    el(
      "button",
      {
        class: "gather-btn",
        disabled,
        title,
        onclick: (ev: Event) => flashThen(ev, () => harvestNode(node.id)),
      },
      [
        el("span", { class: "icon big" }, node.icon),
        el("span", {}, node.name),
        el("span", { class: "node-charges", title: "Charges left" }, `×${charges}`),
      ],
    ),
    isThisActive
      ? renderProgressBar(job!.startedAt, job!.endsAt)
      : el("p", { class: "muted small" }, `⏱ ${formatDuration(dur)}`),
    el("p", { class: "muted small" }, node.description ?? ""),
    !toolOk
      ? el(
          "p",
          { class: "small" },
          `Needs ${node.requiresTool!.type} (tier ≥ ${node.requiresTool!.minTier}).`,
        )
      : null,
    toolLocked.size > 0
      ? el(
          "p",
          { class: "small" },
          `Better tools could yield more: ${Array.from(toolLocked).join(", ")}.`,
        )
      : null,
  ]);
}

function renderProgressBar(startedAt: number, endsAt: number): HTMLElement {
  return el("div", { class: "gather-progress" }, [
    el("div", {
      class: "gather-progress-fill",
      style: `width: ${progressPct(startedAt, endsAt)}%`,
      "data-start": String(startedAt),
      "data-end": String(endsAt),
    }),
  ]);
}

function flashThen(ev: Event, fn: () => void): void {
  const btn = ev.currentTarget as HTMLElement;
  btn.classList.add("flash");
  requestAnimationFrame(() => {
    setTimeout(fn, 60);
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
