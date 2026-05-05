import { ALL_BIOMES } from "../data/biomes";
import { ALL_GATHER_ACTIONS } from "../data/gather";
import { ITEMS } from "../data/items";
import { MACHINES } from "../data/machines";
import { ALL_NODES } from "../data/nodes";
import {
  bestToolTier,
  biomeActiveTime,
  canAfford,
  exploreBiome,
  fitsInDay,
  FLOOR_GATHER_ID,
  forageAutoEatPreview,
  gameNow,
  gather,
  gatherActiveTime,
  gatherDuration,
  harvestNode,
  hasProvisions,
  hasUndiscoveredBiomes,
  nodeActiveTime,
  nodeHarvestDuration,
  onTick,
  store,
  wander,
  wanderActiveTime,
} from "../game/state";
import { WANDER_DURATION_MS } from "../data/wander";
import type { Biome, GatherAction, ResourceNode, Stack } from "../data/types";
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
        const isActive = job?.kind === "harvest" && job.nodeId === node.id;
        if (charges <= 0 && !isActive) continue;
        cards.push(renderNodeCard(node, charges, s, busy, job));
      }
    }

    // Wander to discover new biomes — hidden once everything is found.
    if (hasUndiscoveredBiomes(s)) {
      cards.push(renderWanderCard(s, busy, job));
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
  const inSeason = (d: typeof a.drops[number]): boolean =>
    !d.seasons || d.seasons.includes(s.seasonIndex);
  const toolLocked = new Set<string>();
  const machineLocked = new Map<string, Set<string>>();
  const seasonalDrops: string[] = [];
  const isSeasonal = a.drops.some((d) => d.seasons && d.seasons.length < 4);
  for (const d of a.drops) {
    if (!inSeason(d)) continue;
    const itemName = ITEMS[d.item]!.name;
    if (d.requiresTool && bestToolTier(s, d.requiresTool.type) < d.requiresTool.minTier) {
      toolLocked.add(itemName);
    }
    const gate = d.requiresMachineEverBuilt;
    if (gate && !s.everBuilt[gate]) {
      if (!machineLocked.has(gate)) machineLocked.set(gate, new Set());
      machineLocked.get(gate)!.add(itemName);
    }
    if (isSeasonal && !seasonalDrops.includes(itemName)) seasonalDrops.push(itemName);
  }
  const dur = gatherDuration(s, a);
  const isThisActive = job?.kind === "gather" && job.gatherId === a.id;
  const at = gatherActiveTime(a);
  const isFloor = a.id === FLOOR_GATHER_ID;
  const dayOk = fitsInDay(s, at);
  const budgetOk = canAfford(s, at, isFloor);
  const provOk = hasProvisions(s, a.provisions);
  const gate = gateFor(at, dayOk, budgetOk, provOk, a.provisions, busy && !isThisActive, dur);
  const autoEat = isFloor ? forageAutoEatPreview(s) : [];
  return el("div", { class: "gather-card" }, [
    el(
      "button",
      {
        class: "gather-btn",
        disabled: busy || !dayOk || !budgetOk || !provOk,
        title: gate.title,
        onclick: (ev: Event) => flashThen(ev, () => gather(a.id)),
      },
      [el("span", { class: "icon big" }, a.icon), el("span", {}, a.name)],
    ),
    isThisActive ? renderProgressBar(job!.startedAt, job!.endsAt) : null,
    el("p", { class: "muted small" }, timeLine(dur, at)),
    gate.reason ? el("p", { class: "small" }, gate.reason) : null,
    el("p", { class: "muted small" }, a.description ?? ""),
    autoEat.length > 0
      ? el(
          "p",
          { class: "small", title: "Foraging on an empty budget eats your cheapest food first" },
          `Auto-eats: ${autoEat
            .map((e) => `${e.qty}× ${ITEMS[e.item]?.name ?? e.item}`)
            .join(", ")}`,
        )
      : null,
    a.provisions ? renderProvisions(a.provisions) : null,
    isSeasonal
      ? el(
          "p",
          { class: "small season-drops" },
          `This season: ${seasonalDrops.length > 0 ? seasonalDrops.join(", ") : "nothing's in reach"}.`,
        )
      : null,
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
  s: ReturnType<typeof store.get>,
  busy: boolean,
  job: ReturnType<typeof store.get>["actionJob"],
): HTMLElement {
  const dur = biome.exploreDurationMs;
  const isThisActive = job?.kind === "explore" && job.biomeId === biome.id;
  const at = biomeActiveTime(biome);
  const dayOk = fitsInDay(s, at);
  const budgetOk = canAfford(s, at, false);
  const provOk = hasProvisions(s, biome.provisions);
  const gate = gateFor(at, dayOk, budgetOk, provOk, biome.provisions, busy && !isThisActive, dur);
  return el("div", { class: "gather-card explore-card" }, [
    el(
      "button",
      {
        class: "gather-btn",
        disabled: busy || !dayOk || !budgetOk || !provOk,
        title: gate.title,
        onclick: (ev: Event) => flashThen(ev, () => exploreBiome(biome.id)),
      },
      [
        el("span", { class: "icon big" }, biome.icon),
        el("span", {}, `Explore ${biome.name}`),
      ],
    ),
    isThisActive ? renderProgressBar(job!.startedAt, job!.endsAt) : null,
    el("p", { class: "muted small" }, timeLine(dur, at)),
    gate.reason ? el("p", { class: "small" }, gate.reason) : null,
    el("p", { class: "muted small" }, biome.description ?? ""),
    biome.provisions ? renderProvisions(biome.provisions) : null,
  ]);
}

function renderWanderCard(
  s: ReturnType<typeof store.get>,
  busy: boolean,
  job: ReturnType<typeof store.get>["actionJob"],
): HTMLElement {
  const dur = WANDER_DURATION_MS;
  const isThisActive = job?.kind === "wander";
  const at = wanderActiveTime();
  const dayOk = fitsInDay(s, at);
  const budgetOk = canAfford(s, at, false);
  const gate = gateFor(at, dayOk, budgetOk, true, undefined, busy && !isThisActive, dur);
  return el("div", { class: "gather-card explore-card" }, [
    el(
      "button",
      {
        class: "gather-btn",
        disabled: busy || !dayOk || !budgetOk,
        title: gate.title,
        onclick: (ev: Event) => flashThen(ev, () => wander()),
      },
      [el("span", { class: "icon big" }, "🧭"), el("span", {}, "Wander Further")],
    ),
    isThisActive ? renderProgressBar(job!.startedAt, job!.endsAt) : null,
    el("p", { class: "muted small" }, timeLine(dur, at)),
    gate.reason ? el("p", { class: "small" }, gate.reason) : null,
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
  const at = nodeActiveTime(node);
  const dayOk = fitsInDay(s, at);
  const budgetOk = canAfford(s, at, false);
  const disabled = busy || !toolOk || !dayOk || !budgetOk;
  const title = !toolOk
    ? `Needs ${node.requiresTool!.type} (tier ≥ ${node.requiresTool!.minTier})`
    : !dayOk
      ? `Not enough day-time left — needs ${formatMinutes(at)}, sleep first`
      : !budgetOk
        ? `Not enough energy — needs ${formatMinutes(at)}, eat first`
        : busy && !isThisActive
          ? "Another action is in progress"
          : `Takes ${formatDuration(dur)} (${formatMinutes(at)} in-world) · ${charges} charge${charges === 1 ? "" : "s"} left`;

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
        charges > 0
          ? el("span", { class: "node-charges", title: "Charges left" }, `×${charges}`)
          : null,
      ],
    ),
    isThisActive ? renderProgressBar(job!.startedAt, job!.endsAt) : null,
    el(
      "p",
      { class: "muted small" },
      `${timeLine(dur, at)} · ${charges} charge${charges === 1 ? "" : "s"} left`,
    ),
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
  return Math.min(100, Math.max(0, ((gameNow() - start) / (end - start)) * 100));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`;
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return h % 1 === 0 ? `${h} h` : `${h.toFixed(1)} h`;
}

function timeLine(realDur: number, activeTime: number): string {
  return `⏱ ${formatDuration(realDur)} · ${formatMinutes(activeTime)} in-world`;
}

function gateFor(
  activeTime: number,
  dayOk: boolean,
  budgetOk: boolean,
  provOk: boolean,
  provisions: Stack[] | undefined,
  busyOther: boolean,
  realDur: number,
): { title: string; reason: string | null } {
  if (busyOther) {
    return { title: "Another action is in progress", reason: "Another action is in progress" };
  }
  if (!dayOk) {
    return {
      title: `Not enough day-time left — needs ${formatMinutes(activeTime)}, sleep first`,
      reason: `Needs ${formatMinutes(activeTime)} day-time — sleep first`,
    };
  }
  if (!budgetOk) {
    return {
      title: `Not enough energy — needs ${formatMinutes(activeTime)}, eat first`,
      reason: `Needs ${formatMinutes(activeTime)} energy — eat first`,
    };
  }
  if (!provOk && provisions) {
    const need = provisions
      .map((p) => `${p.qty}× ${ITEMS[p.item]?.name ?? p.item}`)
      .join(", ");
    return {
      title: `Pack rations first — needs ${need}`,
      reason: `Pack rations first — needs ${need}`,
    };
  }
  return {
    title: `Takes ${formatDuration(realDur)} (${formatMinutes(activeTime)} in-world)`,
    reason: null,
  };
}

function renderProvisions(provisions: Stack[]): HTMLElement {
  return el("p", { class: "small provisions" }, [
    el("span", {}, "Pack: "),
    ...provisions.flatMap((p, i) => {
      const it = ITEMS[p.item];
      const label = `${p.qty}× ${it?.name ?? p.item}`;
      const node = el(
        "span",
        { class: "provision-chip", title: "Consumed up-front when the action starts" },
        [el("span", { class: "icon" }, it?.icon ?? "❓"), el("span", {}, label)],
      );
      return i === 0 ? [node] : [el("span", {}, ", "), node];
    }),
  ]);
}
