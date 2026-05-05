# Agriculture Plan

A staged design and build plan for planted crops in Bootstrap Factory.
Drafted in conversation; check items off as they ship.

## Design summary

**Why agriculture next.** Forage already covers food; what it doesn't
cover is *planning*. Seasons currently only modulate which RNG drops
hit the basket. Agriculture turns the season clock into a production
clock: you plant in spring, weed/water through summer, harvest in
autumn, eat through winter. It also fixes two existing chokepoints:

- **Cordage bottleneck.** Every crate, haft, tool and pack passes
  through `twist_cordage`. Flax-as-a-crop adds a second, better cordage
  path and a textile chain to hang cloth/loom off of later.
- **Unused content.** `wheat_seed` and `sunflower_seed` already drop
  from soil and forage but lead nowhere.

**Plots, not tiles.** A `tilled_plot` is a placeable workshop block
(like crate or kiln), authored once, instantiated many times. No grid.
Each plot holds one planting at a time and has its own growth timer.

**Growth on the world clock.** Plots tick on the same `worldClock` /
`Sleep` advance the food system already uses. No new clock. Crops
finish when their `growsForMinutes` countdown hits zero. Sleeping
through a finished plot leaves it sitting ready to harvest — no
spoilage in the field for v1.

**Seasonal gating.** Crops carry `plantSeasons: number[]` and
`harvestSeasons?: number[]`. A wheat seed planted in spring matures
mid-summer; a sunflower planted in summer matures mid-autumn. Planting
out of season is disallowed (greyed-out button, "wheat plants in
spring"). Winter plots sit fallow.

**Yield, not multiplier.** A plot returns more than the seed put in
(seed + grain, seed + sunflower head, seed + flax stalks), so you can
both eat and replant. Yields are tuned so a small plot count
meaningfully shifts the food budget without obsoleting forage.

**No fail state, same as food.** A neglected plot doesn't die or
penalize the player; it just sits unharvested. If the player wants to
ignore the whole system, forage still works.

## Tuning targets

- A wheat plot planted in spring yields enough grain by mid-summer to
  cover ~1 day of food after milling+baking, plus 2–3 seeds for replant.
- A sunflower plot planted in summer yields seeds enough for ~1 press
  of oil by mid-autumn, plus 2–3 seeds for replant.
- A flax plot yields 4–6 stalks per harvest; retted + processed, that's
  ~3 strong cordage — meaningfully more than 3 plant_fiber → 1.5
  cordage from forage, but slower wall-clock.
- Tilled plot is reachable with a flint shovel + a few boards; no
  metal gating on entry.
- First harvest should be available before the player commits to
  bronze tooling — agriculture is a *parallel* track to metallurgy,
  not gated behind it.

## New items (sketch)

- `tilled_plot` — workshop block, placeable. Holds one planting.
- `wheat_grain`, `flour`, `bread` (campfire)
- `sunflower_head`, `sunflower_oil` (oil press, new machine)
- `flax_seed`, `flax_stalks`, `retted_flax`, `linen_thread`,
  `strong_cordage`
- `retting_pit` — new machine. Stalks + time → retted fiber.
- `oil_press` — new machine. Sunflower heads → oil + seedcake.

Strong cordage subs in for plain cordage in any recipe that lists
cordage; plain cordage still works, strong is just better
ratio/yield. Implemented via a `cordage` item tag, mirroring how
`berry`-tagged items already feed `dry_berries`.

## Stages

### Stage 1 — Tilled plot + wheat loop

- Add `tilled_plot` item + workbench recipe (boards + flint shovel
  required as tool, like `crate`).
- Add `wheat_grain`, `flour`, `bread` items. Bread is a food item
  (`satiatesMinutes`, `spoilsAfter`).
- Add a `Plant Wheat` recipe on `tilled_plot` that consumes 1
  `wheat_seed` and produces nothing immediately — instead it kicks
  off a per-plot growth job tracked in state.
- Harvest action returns 2–3 `wheat_grain` + 1–2 `wheat_seed`.
- Hand recipe: 2 grain → 1 flour (mortar-and-pestle feel; later
  superseded by a millstone).
- Campfire recipe: 1 flour + 1 stick → 1 bread.
- Schema bump: `plots: PlotState[]` on GameState (plot id, planted
  crop, plantedAt worldMinute, ready flag).

### Stage 2 — Sunflower + oil press

- `sunflower_head`, `sunflower_oil`, `seedcake` items.
- `oil_press` machine (workbench-built; boards + cordage + bronze
  ingot — first thing that *uses* bronze for something other than a
  tool).
- Plant Sunflower recipe on `tilled_plot`. Plants summer, harvests
  autumn.
- Oil press recipe: 4 sunflower heads → 1 oil + 2 seedcake.
- Oil opens later: oil lamps (extend day?), frying (cooking upgrade
  later), greasing bearings (automation later).

### Stage 3 — Flax + retting + strong cordage

- `flax_seed`, `flax_stalks`, `retted_flax`, `linen_thread`,
  `strong_cordage` items.
- `retting_pit` machine — clay-and-fieldstone build, water-themed.
  Stalks → retted flax over a long timer.
- Hand recipes: retted flax → linen thread; thread → strong cordage.
- Tag `cordage` and `strong_cordage` with the same `cordage` tag;
  migrate existing cordage-consuming recipes to take `{ tag: "cordage" }`
  with a yield bonus when strong cordage is used (or just make strong
  cordage a 1:2 substitute via crafting alias).
- Plant Flax recipe on `tilled_plot`. Spring–summer cycle.

### Stage 4 — Seasonal failure + neglect

- Plots planted out-of-season simply refuse the recipe (UI gating).
- Plots that miss their harvest window by N days "go to seed" — yield
  drops to seeds only, no grain/heads/stalks. No fail state, just lost
  effort.
- Optional: weather/drought events that can be mitigated by watering
  (pulls in pottery jug from the pottery line — cross-feature hook).

### Stage 5 — Quest book wiring

- `tilled_plot` quest ("Turn a plot — wheat in the soil beats berries
  in the brush").
- `bake_bread` quest (introduces the flour → bread chain).
- `strong_cordage` quest (introduces flax retting).
- `oil_press` quest (introduces sunflower oil and bronze-as-machine).

## Open questions

- Plot UX: render plots in their own "field" panel, or interleaved
  with rooms/machines? Lean: own panel, since they tick on a
  different rhythm than machines.
- Watering: required mechanic from day one, or stage-4 optional
  layer? Lean: stage 4 — keep stage 1 frictionless.
- Crop rotation / soil exhaustion: probably out of scope for v1.
  Nice late-game depth but easy to skip.
- Should harvest auto-replant if seeds are available? Lean: no.
  Manual replant keeps the rhythm tactile.

## Build order rationale

Stage 1 is the smallest thing that proves the loop: place a plot,
plant a seed, sleep, harvest. Once that's playable, stages 2–3 are
parallel sidegrades — sunflower for oil, flax for cordage — and
either can ship first or be cut without unwinding stage 1. Stages 4–5
add depth and quest scaffolding once the core feels right.
