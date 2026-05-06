# Icon Style — Bootstrap Factory

> Per-icon descriptions live in `icons.spec.json` (authoritative). This file
> is the human-readable companion: palette, rules, do/don't.

## Feel

Hand-inked illustrations from a homesteader's field journal. Ink line plus a
soft watercolor wash, slight paper grain, transparent background. Each icon
should read as a single tactile object you could pick up off a wooden game
board — not a flat app glyph, not a 3D render.

One-line name: **Tactile Homestead UI** (a.k.a. Rustic parchment-and-wood
survival crafting UI).

## Palette

Anchor colors. No neon, no pure black, no pure white, no glossy highlights.

| Color | Hex | Use |
|---|---|---|
| Walnut brown | `#4b2e1f` | wood, hafts, dark accents |
| Parchment cream | `#efe1c0` | paper, cloth, light surfaces |
| Moss green | `#5b6b3a` | foliage, section accents |
| Ochre | `#c08a3e` | grain, oil, warm highlights |
| Bone | `#f4ead2` | bone, ash, callouts |
| Muted berry red | `#8a2f2a` | fruit, blood, warning rings (sparing) |
| Charcoal | `#2a241f` | ink line, shadows |
| Dull metal | `#8a8275` | iron, tin, generic metal |

Max **6 colors per icon**. Berry red appears only on fruit, cooked-meat warmth,
and warning badges — never on tools or stations.

## Composition rules

- Centered subject, small breathing room around the silhouette.
- Light from **top-left**, soft warm shadow at lower-right.
- Subtle off-axis tilt allowed (drawn-on-a-card feel).
- Optional faint paper grain **inside** the silhouette only.
- **Transparent background**, always. The parchment/wood comes from the UI
  panel, not the icon — never bake it in.
- Uniform ink line weight across the whole set (~3px at 256 res), single ink
  color (`#2a241f`), consistent wash saturation.

## Chain consistency (the important part)

Icons in the same chain must look like a *family*. When in doubt, draw the
base first and let derived icons reuse its silhouette.

- **Tool tiers** (`flint_* → copper_* → bronze_* → iron_*`) — identical haft,
  identical lashing, identical pose. Only the head material/color changes.
- **Ingots** — one trapezoidal brick silhouette, color-only differentiation.
- **Ores** — one chunky rock silhouette; the embedded mineral color/streak
  differs.
- **Stations** — drawn at the same three-quarter angle so they read as a set.
- **Cooked / dried variants** reuse the raw silhouette, only the surface
  treatment changes (charred, leathery, wilted).
- **UI mini-chains** — meter glyphs, season chips, warning badges, quest
  states, and pin states each share one footprint; only the central motif
  changes.

## Seasonal tinting

Most icons render in their default summer key. Items with a strong seasonal
home (spring shoots, elderberries, frozen tuber) shift the wash:

- **Spring** — cool fresh greens, pale ochre.
- **Summer** — warm full saturation (default).
- **Autumn** — deeper ochre, dusk red, browned greens.
- **Winter** — desaturated, slate-cool wash, frost highlights.

## Do / don't

| Do | Don't |
|---|---|
| Draw transparent background | Bake parchment or wood behind the subject |
| Reuse the haft across tool tiers | Redesign the haft for each tier |
| Use berry red for fruit and warning rings | Use berry red on tools or metal |
| Keep ink line one color and one weight | Vary line weight or use multi-color outlines |
| Light from top-left | Add rim lights, neon glows, or specular highlights |
| One subject, centered | Compose mini-scenes inside the icon |

## Updating

Add new icons to `icons.spec.json` (the JSON is the source of truth per
icon). Update this file only when the *style itself* changes — palette,
composition rules, or chain conventions.
