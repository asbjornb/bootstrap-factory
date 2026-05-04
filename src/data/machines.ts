import type { Machine, MachineId } from "./types";

const list: Machine[] = [
  { id: "hand", name: "By Hand", icon: "✋", description: "Simple recipes you can make with your bare hands." },
  { id: "workbench", name: "Workbench", icon: "🧰", description: "Bench-assembled recipes — tools, crates, larger machines." },
  { id: "charcoal_pit", name: "Charcoal Pit", icon: "🔥", description: "Smolders logs into charcoal, slowly." },
  { id: "clay_kiln", name: "Clay Kiln", icon: "🏺", description: "Fires bricks and crucibles, smelts copper and tin, alloys bronze." },
  { id: "bloomery", name: "Bloomery", icon: "🏭", description: "A refractory stack hot enough for iron." },
];

export const MACHINES: Record<MachineId, Machine> = Object.fromEntries(list.map((m) => [m.id, m]));
export const ALL_MACHINES: Machine[] = list;

export function machine(id: MachineId): Machine {
  const m = MACHINES[id];
  if (!m) throw new Error(`Unknown machine: ${id}`);
  return m;
}
