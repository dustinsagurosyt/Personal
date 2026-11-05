# Attention Reset · Shop and rare pets

## Shop unlock ladder

A completed day means both daily goals were met. Categories open for free after the required number of total completed days. The days can be spread out, and earlier purchases are optional. Pebbles buy items inside each category. Owned items stay unlocked and can be equipped again for free.

| Completed days | Category | First item or purpose |
|---:|---|---|
| 3 | Pot Studio | 3 pebbles. Terracotta, sage ceramic, and speckled stone. |
| 7 | Companion Shop | Free to open. Choose and preview pets before buying one. |
| 12 | Lighting & Ambience | Firefly Lantern, 15 pebbles. Works with one plot. |
| 16 | Paths & Layout | Stepping-Stone Path, 6 pebbles. The second plant starts growing. |
| 23 | Garden Themes | Seasonal Skins, 35 pebbles. Style the entire garden. |
| 31 | Water Features | Garden Pond, 20 pebbles. The third plot starts growing. |
| 45 | Structures & Displays | Glass Greenhouse, 50 pebbles. Three plants are fully grown. |

Show progress toward only the next category at the top of Shop. For example, “5 of 7 completed days” for Companion Shop. Other categories remain visible in the ladder.

## Shop category catalogs

### Paths & Layout

| Item | Price | What it adds |
| --- | --- | --- |
| Stepping-Stone Path | 6 pebbles | A customizable path between garden plots. |

### Lighting & Ambience

| Item | Price | What it adds |
| --- | --- | --- |
| Firefly Lantern | 15 pebbles | Warm dusk lighting with drifting fireflies. |
| String Lights | Price TBD | Drape warm bulbs between pots or across a trellis. |
| Moon Lamps | Price TBD | Place small lamps that cast a cool glow. |
| Candle Path | Price TBD | Line the edge of your path with softly flickering candles. |

### Water Features

| Item | Price | What it adds |
| --- | --- | --- |
| Garden Pond | 20 pebbles | Lily pads and water that ripples when tapped. |
| Birdbath | Price TBD | Add a shallow basin with ripples when a bird lands. |
| Stone Fountain | Price TBD | Water trickles over stacked stones. |
| Mini Creek | Price TBD | A narrow stream winds between garden plots. |

### Garden Themes

| Item | Price | What it adds |
| --- | --- | --- |
| Seasonal Skins | 35 pebbles | Switch between spring blossoms, autumn leaves, and snow. |
| Rainy Morning | Price TBD | Soft rain and a misty garden palette. |
| Desert Garden | Price TBD | Warm sand tones and a dry garden backdrop. |
| Moonlit Garden | Price TBD | Cool nighttime colors and a soft moon glow. |

### Structures & Displays

| Item | Price | What it adds |
| --- | --- | --- |
| Glass Greenhouse | 50 pebbles | Display favorite mature plants and replay their growth. |
| Plant Shelf | Price TBD | Arrange favorite pots on a tiered shelf. |
| Climbing Trellis | Price TBD | Give vines a decorative frame. |
| Garden Arch | Price TBD | Frame the entrance with a flowering arch. |

## Companion Shop

**Open follow-up — Fix companion movement in the Playground.** Review all eight companions at phone size. Give each species a distinct route and gait, smooth out turns and landings, and keep movement inside the assigned plant card. Check that the leaves and pot naturally cover companions on behind-the-plant passes. Review the animations in the Playground before shipping them.

Proposed unlock: complete both goals on any 7 days. The unlock itself is free, and the days can be spread out.
Once unlocked, players can preview and buy any available companion without a required purchase order.

| Companion | Price | Garden behavior |
| --- | --- | --- |
| Ladybug | 10 pebbles | Crawls between plants and opens its wings when tapped. |
| Bumblebee | 15 pebbles | Visits flowers and loops when tapped. In a garden without blooms, it rests on a pot rim. |
| Pill Bug | 20 pebbles | Explores the soil around pots and rolls into a ball when tapped. |
| Snail | 25 pebbles | Leaves a faint trail as it explores, then peeks out of its shell when tapped. |
| Sparrow | 30 pebbles | Hops between pot rims in the morning and tilts its head when tapped. |
| Garden Gecko | 40 pebbles | Basks on a warm stone and scurries to a nearby pot when tapped. |
| Cottontail Rabbit | 45 pebbles | Hops along the garden edge, sniffs plants, and twitches its ears when tapped. |
| Sleepy Cat | 55 pebbles | Naps in a sunny spot beside a pot and stretches when tapped. |

Suggested first release: Ladybug, Bumblebee, and Snail. No decor purchase is required for a pet. Paths and ponds give pets more places to explore.

## Rare-pet milestones

Rare pets would unlock once when a milestone is reached. These pets are earned separately from the Companion Shop catalog. These milestones are proposed starting points.

| Milestone | Rare pet | Garden behavior |
| --- | --- | --- |
| 14 consecutive days with both goals met | Moon Moth | Circles a favorite plant, then rests with its wings open. |
| 30 consecutive days with both goals met | Blue Dragonfly | Hovers near the plants and briefly lands when tapped. |
| 60 consecutive days with both goals met | Golden Frog | Hops between plots and settles near the pond if one is equipped. |
| 100 total days with both goals met | Pygmy Hedgehog | Wanders the garden and uncurls when tapped. |

Show progress toward the next rare pet, such as **11 of 14 days to the Moon Moth**. Missing a day resets progress toward a streak milestone. Unlocked pets stay yours, and the 100-day milestone counts completed days even when they are spread out. Rare pets can appear in any garden without requiring a decor purchase.

## Saved design direction

**Complete in the app.** The Shop uses the approved garden-vignette design and shows category unlocks from completed days. The design can be revised later. It uses a forest-green Next unlock card, a category illustration that changes with the milestone, a progress bar, and compact rows with individual artwork. Category rows expand for details. The preview starts at 38 of 45 completed days with Structures & Displays up next.

- [Implemented garden-vignette design](previews/shop-unlocks-garden-vignettes.html)
- [Earlier illustrated Shop design](previews/shop-unlocks-illustrated.html)
- [Five earlier layout alternatives](previews/five-shop-unlock-layouts.html)
- [Original interactive unlock ladder](previews/shop-unlock-preview.html)
- [Interactive roadmap board](previews/attention-reset-shop-unlock-roadmap.html)

These files preserve the design previews. The earlier five-layout gallery uses the Codex visualization carousel.

## Live foundation and suggested build order

The live app has Home, Garden, and Shop tabs. It awards 1 pebble per completed day and 2 extra every fifth consecutive completed day. The illustrated Shop ladder and completed-day category status are live. Unlocked categories open their own titled catalog screens with planned prices. Spending, ownership, and pet unlocks are planned.

1. Track spending and ownership.
2. Implement Pot Studio purchases and equipping.
3. Add the Companion Shop and pet behaviors.
4. Add rare-pet milestone tracking.
