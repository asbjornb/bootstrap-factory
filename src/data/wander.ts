import type { BiomeId } from "./types";

export interface WanderOutcome {
  weight: number;
  message: string;
  /** If set, fires only while this biome is undiscovered, and discovers it on success. */
  discoverBiome?: BiomeId;
}

export const WANDER_DURATION_MS = 5000;
/** In-world minutes spent on a wander. Derived at the global time scale (1 real sec = 8 in-world min). */
export const WANDER_ACTIVE_TIME = 40;

// Foothills is weighted high so flint (and the first real toolkit) is
// reliably reachable within a couple of wanders, even on an unlucky run.
export const WANDER_OUTCOMES: WanderOutcome[] = [
  {
    weight: 5,
    message: "You crest a low ridge and a stretch of open meadow opens up below.",
    discoverBiome: "meadow",
  },
  {
    weight: 8,
    message: "Past the trees the ground rises into stony foothills.",
    discoverBiome: "foothills",
  },
  {
    weight: 2,
    message: "You wander far and come back no wiser for it.",
  },
];
