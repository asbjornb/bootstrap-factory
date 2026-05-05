import type { Machine, MachineId } from "./types";

const list: Machine[] = [
  { id: "hand", name: "By Hand", icon: "✋", description: "Simple recipes you can make with your bare hands." },
  { id: "workbench", name: "Workbench", icon: "🧰", description: "Bench-assembled recipes — tools, crates, larger machines." },
  { id: "campfire", name: "Campfire", icon: "🔥", description: "An open fire ringed in stone. Roasts and boils early forage into hotter, richer meals." },
  { id: "charcoal_pit", name: "Charcoal Pit", icon: "🔥", description: "Smolders logs into charcoal, slowly." },
  { id: "clay_kiln", name: "Clay Kiln", icon: "🏺", description: "Fires bricks and crucibles, smelts copper and tin, alloys bronze." },
  { id: "bloomery", name: "Bloomery", icon: "🏭", description: "A refractory stack hot enough for iron." },
  { id: "drying_rack", name: "Drying Rack", icon: "🪵", description: "Open-air rack for preserving raw food into something that keeps." },
  { id: "tilled_plot", name: "Tilled Plot", icon: "🟫", description: "A bed of turned soil. Plant a seed in season; wait for the harvest." },
  { id: "oil_press", name: "Oil Press", icon: "🫒", description: "Crushes sunflower heads into oil and seedcake." },
  { id: "retting_pit", name: "Retting Pit", icon: "🪣", description: "Soaks flax stalks until the fibers come free." },
];

export const MACHINES: Record<MachineId, Machine> = Object.fromEntries(list.map((m) => [m.id, m]));
export const ALL_MACHINES: Machine[] = list;

export function machine(id: MachineId): Machine {
  const m = MACHINES[id];
  if (!m) throw new Error(`Unknown machine: ${id}`);
  return m;
}
