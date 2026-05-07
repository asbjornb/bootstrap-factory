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
import { isTagInput } from "../data/types";
import type { Biome, GatherAction, ItemId, RecipeInput, ResourceNode } from "../data/types";
import { clear, el } from "./dom";
import { iconEl } from "./icon";

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
  const toolLocked = new Set<ItemId>();
  const machineLocked = new Map<string, Set<ItemId>>();
  const available: ItemId[] = [];
  for (const d of a.drops) {
    if (!inSeason(d)) continue;
    const machineGate = d.requiresMachineEverBuilt;
    const machineMissing = !!machineGate && !s.everBuilt[machineGate];
    if (machineMissing) {
      if (!machineLocked.has(machineGate!)) machineLocked.set(machineGate!, new Set());
      machineLocked.get(machineGate!)!.add(d.item);
      continue;
    }
    if (d.requiresTool && bestToolTier(s, d.requiresTool.type) < d.requiresTool.minTier) {
      toolLocked.add(d.item);
    }
    if (!available.includes(d.item)) available.push(d.item);
  }
  const isThisActive = job?.kind === "gather" && job.gatherId === a.id;
  const at = gatherActiveTime(a);
  const isFloor = a.id === FLOOR_GATHER_ID;
  const toolOk = !a.requiresTool || bestToolTier(s, a.requiresTool.type) >= a.requiresTool.minTier;
  const dayOk = fitsInDay(s, at);
  const budgetOk = canAfford(s, at, isFloor);
  const provOk = hasProvisions(s, a.provisions);
  const disabled = busy || !toolOk || !dayOk || !budgetOk || !provOk;
  const autoEat = isFloor ? forageAutoEatPreview(s) : [];

  const title = buildTitle([
    a.description,
    available.length > 0
      ? `Drops: ${available.map((id) => ITEMS[id]?.name ?? id).join(", ")}.`
      : null,
    toolLocked.size > 0
      ? `Better tools could yield more: ${[...toolLocked].map((id) => ITEMS[id]?.name ?? id).join(", ")}.`
      : null,
    ...[...machineLocked.entries()].map(
      ([m, ids]) =>
        `Build a ${MACHINES[m]?.name ?? m} to start collecting: ${[...ids].map((id) => ITEMS[id]?.name ?? id).join(", ")}.`,
    ),
    autoEat.length > 0
      ? `Auto-eats on empty: ${autoEat.map((e) => `${e.qty}× ${ITEMS[e.item]?.name ?? e.item}`).join(", ")}`
      : null,
    a.provisions ? `Pack: ${a.provisions.map(provisionLabel).join(", ")}` : null,
    gateReason(at, dayOk, budgetOk, provOk, busy && !isThisActive, toolOk, a.requiresTool),
  ]);

  return el("div", { class: "gather-card" }, [
    el(
      "button",
      {
        class: "gather-btn",
        disabled,
        title,
        onclick: (ev: Event) => flashThen(ev, () => gather(a.id)),
      },
      [
        el("span", { class: "icon" }, a.icon),
        el("span", { class: "gather-name" }, a.name),
        el("span", { class: "gather-time" }, `⏱ ${formatMinutes(at)}`),
        renderDropIcons(available, toolLocked),
        renderWarns({
          toolOk,
          toolReq: a.requiresTool,
          dayOk,
          budgetOk,
          activeTime: at,
          provOk,
          provisions: a.provisions,
        }),
      ],
    ),
    isThisActive ? renderProgressBar(job!.startedAt, job!.endsAt) : null,
  ]);
}

function renderExploreCard(
  biome: Biome,
  s: ReturnType<typeof store.get>,
  busy: boolean,
  job: ReturnType<typeof store.get>["actionJob"],
): HTMLElement {
  const isThisActive = job?.kind === "explore" && job.biomeId === biome.id;
  const at = biomeActiveTime(biome);
  const dayOk = fitsInDay(s, at);
  const budgetOk = canAfford(s, at, false);
  const provOk = hasProvisions(s, biome.provisions);
  const disabled = busy || !dayOk || !budgetOk || !provOk;
  const title = buildTitle([
    biome.description,
    biome.provisions ? `Pack: ${biome.provisions.map(provisionLabel).join(", ")}` : null,
    gateReason(at, dayOk, budgetOk, provOk, busy && !isThisActive, true, undefined),
  ]);
  return el("div", { class: "gather-card explore-card" }, [
    el(
      "button",
      {
        class: "gather-btn",
        disabled,
        title,
        onclick: (ev: Event) => flashThen(ev, () => exploreBiome(biome.id)),
      },
      [
        el("span", { class: "icon" }, biome.icon),
        el("span", { class: "gather-name" }, `Explore ${biome.name}`),
        el("span", { class: "gather-time" }, `⏱ ${formatMinutes(at)}`),
        renderWarns({
          toolOk: true,
          dayOk,
          budgetOk,
          activeTime: at,
          provOk,
          provisions: biome.provisions,
        }),
      ],
    ),
    isThisActive ? renderProgressBar(job!.startedAt, job!.endsAt) : null,
  ]);
}

function renderWanderCard(
  s: ReturnType<typeof store.get>,
  busy: boolean,
  job: ReturnType<typeof store.get>["actionJob"],
): HTMLElement {
  const isThisActive = job?.kind === "wander";
  const at = wanderActiveTime();
  const dayOk = fitsInDay(s, at);
  const budgetOk = canAfford(s, at, false);
  const flavor = "Strike out beyond the familiar woods. There must be other places worth knowing.";
  const disabled = busy || !dayOk || !budgetOk;
  const title = buildTitle([
    flavor,
    gateReason(at, dayOk, budgetOk, true, busy && !isThisActive, true, undefined),
  ]);
  return el("div", { class: "gather-card explore-card" }, [
    el(
      "button",
      {
        class: "gather-btn",
        disabled,
        title,
        onclick: (ev: Event) => flashThen(ev, () => wander()),
      },
      [
        el("span", { class: "icon" }, "🧭"),
        el("span", { class: "gather-name" }, "Wander Further"),
        el("span", { class: "gather-time" }, `⏱ ${formatMinutes(at)}`),
        renderWarns({
          toolOk: true,
          dayOk,
          budgetOk,
          activeTime: at,
          provOk: true,
          provisions: undefined,
        }),
      ],
    ),
    isThisActive ? renderProgressBar(job!.startedAt, job!.endsAt) : null,
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

  const toolLocked = new Set<ItemId>();
  const machineLocked = new Map<string, Set<ItemId>>();
  const available: ItemId[] = [];
  for (const d of node.drops) {
    const machineGate = d.requiresMachineEverBuilt;
    const machineMissing = !!machineGate && !s.everBuilt[machineGate];
    if (machineMissing) {
      if (!machineLocked.has(machineGate!)) machineLocked.set(machineGate!, new Set());
      machineLocked.get(machineGate!)!.add(d.item);
      continue;
    }
    if (d.requiresTool && bestToolTier(s, d.requiresTool.type) < d.requiresTool.minTier) {
      toolLocked.add(d.item);
    }
    if (!available.includes(d.item)) available.push(d.item);
  }

  const title = buildTitle([
    node.description ?? `Takes ${formatDuration(dur)} (${formatMinutes(at)} in-world)`,
    available.length > 0
      ? `Drops: ${available.map((id) => ITEMS[id]?.name ?? id).join(", ")}.`
      : null,
    toolLocked.size > 0
      ? `Better tools could yield more: ${[...toolLocked].map((id) => ITEMS[id]?.name ?? id).join(", ")}.`
      : null,
    ...[...machineLocked.entries()].map(
      ([m, ids]) =>
        `Build a ${MACHINES[m]?.name ?? m} to start collecting: ${[...ids].map((id) => ITEMS[id]?.name ?? id).join(", ")}.`,
    ),
    gateReason(at, dayOk, budgetOk, true, busy && !isThisActive, toolOk, node.requiresTool),
  ]);

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
        el("span", { class: "icon" }, node.icon),
        el("span", { class: "gather-name" }, node.name),
        el("span", { class: "gather-time" }, `⏱ ${formatMinutes(at)}`),
        renderDropIcons(available, toolLocked),
        charges > 0
          ? el("span", { class: "node-charges", title: `${charges} charges left` }, `×${charges}`)
          : null,
        renderWarns({
          toolOk,
          toolReq: node.requiresTool,
          dayOk,
          budgetOk,
          activeTime: at,
          provOk: true,
          provisions: undefined,
        }),
      ],
    ),
    isThisActive ? renderProgressBar(job!.startedAt, job!.endsAt) : null,
  ]);
}

function renderDropIcons(available: ItemId[], toolLocked: Set<ItemId>): HTMLElement | null {
  if (available.length === 0) return null;
  return el(
    "span",
    { class: "gather-drops" },
    available.map((id) => {
      const item = ITEMS[id];
      const locked = toolLocked.has(id);
      return el(
        "span",
        {
          class: locked ? "drop-icon locked" : "drop-icon",
          title: locked
            ? `${item?.name ?? id} (better tool yields more)`
            : item?.name ?? id,
        },
        [iconEl(id as string, item?.icon ?? "❓", "drop-icon-glyph")],
      );
    }),
  );
}

interface WarnContext {
  toolOk: boolean;
  toolReq?: { type: string; minTier: number };
  dayOk: boolean;
  budgetOk: boolean;
  activeTime: number;
  provOk: boolean;
  provisions?: RecipeInput[];
}

function renderWarns(c: WarnContext): HTMLElement | null {
  const icons: HTMLElement[] = [];
  if (!c.toolOk && c.toolReq) {
    icons.push(
      warnIcon("⚒️", `Needs ${c.toolReq.type} (tier ≥ ${c.toolReq.minTier})`),
    );
  }
  if (!c.dayOk) {
    icons.push(warnIcon("💤", `Needs ${formatMinutes(c.activeTime)} day-time — sleep first`));
  }
  if (!c.budgetOk) {
    icons.push(warnIcon("🍞", `Needs ${formatMinutes(c.activeTime)} stamina — eat first`));
  }
  if (c.provisions) {
    const label = `Pack: ${c.provisions.map(provisionLabel).join(", ")}`;
    icons.push(
      el(
        "span",
        { class: c.provOk ? "warn-icon prov-ok" : "warn-icon", title: label },
        "🥡",
      ),
    );
  }
  if (icons.length === 0) return null;
  return el("span", { class: "gather-warns" }, icons);
}

function warnIcon(icon: string, title: string): HTMLElement {
  return el("span", { class: "warn-icon", title }, icon);
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

function buildTitle(parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => !!p).join("\n");
}

function gateReason(
  activeTime: number,
  dayOk: boolean,
  budgetOk: boolean,
  provOk: boolean,
  busyOther: boolean,
  toolOk: boolean,
  toolReq: { type: string; minTier: number } | undefined,
): string | null {
  if (busyOther) return "Another action is in progress";
  if (!toolOk && toolReq) return `Needs ${toolReq.type} (tier ≥ ${toolReq.minTier})`;
  if (!dayOk) return `Needs ${formatMinutes(activeTime)} day-time — sleep first`;
  if (!budgetOk) return `Needs ${formatMinutes(activeTime)} stamina — eat first`;
  if (!provOk) return `Pack rations first`;
  return null;
}

function provisionLabel(p: RecipeInput): string {
  if (isTagInput(p)) return `${p.qty}× any ${p.tag}`;
  return `${p.qty}× ${ITEMS[p.item]?.name ?? p.item}`;
}
