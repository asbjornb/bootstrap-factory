# Early Storage Design

Notes and decisions for the early-game carry / storage track. Captures
what we have, what changes now, and what's intentionally deferred.

## Where we landed

Storage stays deliberately tight in the early game — it's part of the
"messy workshop" feel. Worn carry gear is the primary lever for the
first few hours; stationary crates handle the surplus.

### Worn carry gear

Carry bonuses **stack** across owned worn items. The player can wear a
pouch *and* a pack at the same time, and each contributes its own
bonus. The items still live in the inventory and each takes one slot,
so owning them has a real cost early when slots are scarcest.

Bonuses are read off ownership, not equipment slots — keeping the data
model simple. (We can promote them to a real equipment slot later if
the inventory-slot cost stops feeling meaningful.)

| Item        | Carry bonus | Tier        | Notes                                  |
| ----------- | ----------- | ----------- | -------------------------------------- |
| Belt Pouch  | +2          | Stone age   | Cheap, early. Net +1 after its own slot. |
| Haul Pack   | +6          | Stone age   | Bigger, needs an axe. Net +5 after its own slot. |
| (Pack Mule) | +N          | Domestication (future) | Replaces the bronze pack thematically. |

Wearing both is the expected mid-stone-age loadout: 8 base + 2 + 6 =
**16 cap**, minus 2 for the items themselves = **14 effective stuff
slots**. That's roughly double the bare-hands carrying capacity, and
gets you through to the bronze-bound crate / bigger workshop phase.

### Stationary storage

Unchanged for now:

- **Crate** — 16 slots, basic wooden chest.
- **Bronze-Bound Crate** — 32 slots, bronze tier.
- **Clay Jar / Pitched Jar** — food-only, with spoilage multipliers.

## What we're deferring

These are good ideas but want a material gate that doesn't exist yet,
so they wait for the leather / domestication pass.

- **Tool Pouch** — a leather belt that only accepts items with a
  `tool` field, granting +N tool-only slots. Tools (axe, pick, shovel
  by tier) eat 3+ slots of a tight inventory just sitting there;
  giving them a dedicated home is a satisfying "graduate to leather
  gear" beat. Needs leather, which arrives with hunting / domesticated
  animals.
- **Pack Mule** — replaces the bronze-frame pack as the late-game
  carry option. Thematically stronger than "your pack got stitched
  with bronze." Needs domesticated animals. Open question: is it just
  +slots, or a mobile crate that follows you between rooms? Pick at
  implementation time.

## What we're removing now

- **Bronze-Frame Pack** (`bronze_pack`) — deleted. Its design slot is
  taken by the future Pack Mule. Removing it now keeps the recipe book
  honest and stops players crafting an item we're about to retire.
  The bronze tier loses a carry-gear unlock until the mule lands;
  that's fine — the bronze-bound crate already covers stationary
  storage at that tier, and stacked Belt Pouch + Haul Pack still
  carries plenty.

## Plan

- [x] Belt Pouch and Haul Pack stack — `bestCarryBonus` becomes a sum.
- [x] Rebalance: Belt Pouch +2, Haul Pack +6 (was +4, +8, with
  highest-wins).
- [x] Update Belt Pouch quest benefit text.
- [x] Delete `bronze_pack` item and recipe.
- [ ] **Future (with leather):** Tool Pouch — equipment-style slot
  scoped to items with `tool`. Will probably want a real equipment
  slot in state at that point, since "tool pouch acts as inventory
  expansion only for tools" is harder to express via ownership alone.
- [ ] **Future (with domestication):** Pack Mule — replaces bronze
  pack at the bronze/iron transition. Decide mobile-crate vs.
  flat-cap-bonus when implementing.
