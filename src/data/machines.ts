import type { Machine, MachineId } from "./types";

const list: Machine[] = [
  { id: "hand", name: "By Hand", icon: "✋", description: "Simple recipes you can make with your bare hands." },
  { id: "crafting_table", name: "Crafting Table", icon: "🧰", description: "Bench-crafted recipes." },
  { id: "furnace", name: "Furnace", icon: "🔥", description: "Heat-based processing: smelting, baking, alloying." },
];

export const MACHINES: Record<MachineId, Machine> = Object.fromEntries(list.map((m) => [m.id, m]));
export const ALL_MACHINES: Machine[] = list;

export function machine(id: MachineId): Machine {
  const m = MACHINES[id];
  if (!m) throw new Error(`Unknown machine: ${id}`);
  return m;
}
