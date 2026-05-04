# Food Mechanic Plan

A staged design and build plan for the food / hunger / day-length system in
Bootstrap Factory. Drafted in conversation; check items off as they ship.

## Design summary

**Unified time clock, no fail state.** Food is the player's daily *time
budget*. Every action has an `activeTime` cost; while the player is busy
their time budget drains. When the budget hits zero, only a small set of
food-tagged actions remain clickable — there's no death, just a soft wall
that always has at least one escape (the always-available "Forage
Nearby"). Background processes (machines, growth, spoilage) run on the
same world clock but do not consume the player's food budget.

**Why time, not action points.** We already need a world clock for
spoilage, growth, and seasons; running an action-points economy alongside
it would be two systems doing similar work. Time-based also gives
"longer / more elaborate actions cost more food up front" for free, and
makes preservation a real progression layer ("a day of jerky = a day of
work").

**Two food costs on actions.**

- `activeTime` — minutes drained from the time budget while the action
  runs. The default cost everything has.
- `provisions` — flat food items consumed up front (rations packed for
  the trip). Optional, used mostly for expeditions.

**Day length + sleep.** Each in-world day is 16 active hours. An action
is unclickable if its `activeTime` would push the world clock past hour
16. A `Sleep` action advances the clock to morning, ticking spoilage,
machine progress, plant growth, traps, and seasons. Sleep itself costs
no food.

**Early game = food-bound, late game = day-bound.** Tune so a full day
of food budget early is ~6–8 in-world hours; a half-day of foraging
yields slightly more than a full day's food (≈50% foraging time, the
hunter-gatherer feel). With better tools / agriculture / preservation,
food budget grows past the 16h day, surplus rolls into expeditions.

**Always-recoverable floor.** A baseline `Forage Nearby` action is
always available, costs ~15min `activeTime`, and yields ~30–60min of
food. If the player's budget hits zero, this single action is treated as
free so the loop is never bricked.

## Tuning targets

- Foraging takes ~50% of early-day time.
- Shovel, belt pouch, and clay kiln are reachable before any
  preservation tech is required.
- Day = 16 active hours. First-day food budget ≈ 6–8h.
- Berry ≈ 30min food, smoked fish ≈ 4h, jerky ≈ 8h (rough targets).

## Stages

### Stage 1 — Food items + Forage Nearby [done]

- Add a small set of perishable raw foods to `items.ts` (berries, edible
  roots). No spoilage logic yet — that lands in stage 5.
- Add a `Forage Nearby` always-on `GatherAction`. Slow, low yield, no
  charges, no node required. This becomes the floor that the rest of
  the system can lean on.
- No state schema changes. No UI changes (existing gather panel
  already renders ambient `GATHER_ACTIONS`).

### Stage 2 — Hunger as time budget

- Add `timeBudget` (minutes remaining today) and `dayLength` (16h
  default) to `GameState`. Bump schemaVersion.
- New header / sidebar widget: "≈ 6 hours of work left today". Don't
  show raw minutes — show rounded hours.
- Tag food items with `food: { satiatesMinutes: number }`. Add an "Eat"
  affordance from inventory: consumes one stack, refunds time budget
  (capped at dayLength).
- No gating yet. Just show the meter and let the player eat. This
  isolates the visualization work from the rules work.

### Stage 3 — `activeTime` on actions; budget gating

- Add `activeTime` to `GatherAction`, `ResourceNode`, `Recipe`,
  `BiomeOutcome` etc. Migrate existing `baseDurationMs` / speedups to
  drive both real-time progress AND in-world `activeTime` (probably
  same number, just typed in minutes).
- Action button greys out if `activeTime > timeBudget`, with tooltip
  "needs 4h, you have 2h".
- Special-case `Forage Nearby` as the always-clickable floor.
- At this point starvation gating is real: at 0 budget only food-tagged
  actions remain.

### Stage 4 — Day length + Sleep

- Add `worldClock` (minutes since dawn of day N) and `dayNumber` to
  `GameState`. Active actions advance `worldClock` by their
  `activeTime`.
- Disable any action whose `activeTime` would push `worldClock` past
  `dayLength`.
- Add a `Sleep` button. Advances world clock to next dawn, resolves any
  background jobs whose finish time falls inside the skipped interval,
  resets the day, fires daily events.
- Background machine jobs continue to use real-time `endsAt`; on sleep
  we fast-forward `Date.now()`-equivalent for them. Verify
  `tickJobs(now)` handles a big jump cleanly.

### Stage 5 — Spoilage + preservation

- Add `spoilsAfter: minutes` to perishable food items. Track per-stack
  spoilage timer (probably as separate inventory entries keyed by
  spawn time, or a "freshness" countdown on the stack).
- Drying rack and smoker recipes: `raw_berries → dried_berries`,
  `raw_fish → smoked_fish`. Preserved foods have larger
  `satiatesMinutes` and effectively no spoilage.
- Sleep / world-clock advance ticks spoilage. Spoiled food is
  destroyed (or downgraded to compost) silently with a toast.

### Stage 6 — `provisions` + long expeditions

- Add `provisions: Stack[]` field to actions (and biome outcomes).
  Consumed up front before the action starts.
- Tag a couple expeditions with provisions: e.g. `Explore Swamp`
  requires 3 dried berries or equivalent. Multi-day expeditions become
  possible once `activeTime > dayLength` is allowed iff provisions
  cover the gap.
- This is also where hunting tools (spear, bow), traps, and fishing
  rods slot in as new high-yield food sources.

### Stage 7 — Seasons

- Slow cycle (e.g. every N sleeps = 1 season; 4 seasons = 1 year).
- Modulate node spawn rates by season (berries summer/fall, fish runs
  spring, etc.). Pure tuning layer; no new mechanics.

## Open questions

- Time budget UX: bar, dial, or text? Probably text + bar for v1.
- Should sleeping with leftover food budget waste it, or roll some
  fraction over? Lean: waste it. Encourages "use it or lose it"
  rhythm; preservation is the proper way to bank food.
- How does eating mid-action work — pause action, refund time, allow
  another swing? Easiest: eating only valid when not in an action.
- Multiplayer: shared clock or per-player budget? Out of scope for
  early stages.

## Build order rationale

Each stage stands alone. After stage 1 the game is fully playable —
food is just a flavor item that exists. Stages 2–4 introduce the rules
incrementally so each can be playtested before the next. Stages 5–7
are pure depth on top of a working core; if any feels bad, it can be
cut without unwinding earlier work.
