# forma studio motion audit

source: `https://formastudio.framer.ai/`, inspected at 1440x900, 1024x900, and 390x844. findings come from the live dom plus the public framer bundles, not from visual guesswork.

## highest-fidelity motion model

- this page does **not** use a custom cursor. `body` resolves to `cursor: auto`; interactive links/buttons use the normal pointer cursor. the generic `.framer-cursor-none` rule is shipped by framer but is never attached.
- there is **no marquee** and no autonomous horizontal ticker. the large `Forma Studio®` hero/footer wordmarks are static.
- most scroll animation is discrete and one-shot, not scrubbed. elements start at `y: 80`, invisible, then reveal when any part enters the viewport. the services composition is a css sticky stack, not a scrub timeline.
- global wheel smoothing is lenis `1.0.42` with `duration: 1` second and its default exponential easing: `min(1, 1.001 - 2^(-10t))`. the document gets `html.lenis.lenis-smooth`.
- every small section-label dot has a perpetual 1.5s pulse: inner dot stays solid; outer dot animates `scale(1) / opacity(.6)` to `scale(2.2) / opacity(0)` by 70%, then holds through 100%.

## load and in-view reveals

| target | start state | timing | trigger |
| --- | --- | --- | --- |
| hero content container | `opacity: .001`, `y: 80` | 1s, cubic bezier `[.23,.83,.56,1]` | page load |
| hero copy and selected display copy | words individually at `opacity: .001`, `y: 20` | 1s, bezier `[.44,0,.13,.96]`, 20ms word offset | in view |
| about content | `opacity: 0`, `y: 80` | .5s, bezier `[.23,.83,.56,1]` | first pixel in view, once |
| projects heading, services intro, testimonials | `opacity: 0`, `y: 80` | 1s, bezier `[.23,.83,.56,1]` | first pixel in view, once |
| project cards | `opacity: 0`, `y: 80` | spring `damping:30, mass:5, stiffness:40` | each card in view, once |
| process section | `opacity: 0`, `y: 80` | 1s, bezier `[.23,.83,.56,1]` | 50% intersection, once |
| faq and footer content | `opacity: 0`, `y: 80` | 1s, bezier `[.23,.83,.56,1]` | first pixel in view, once |
| cta foreground | `opacity: 0`, `y: 80` | .5s, bezier `[.23,.83,.56,1]` | first pixel in view, once |

framer sets `animateOnce: true` everywhere above. scrolling back does not replay or reverse a reveal.

the three about metrics use digit-by-digit vertical odometer rolls rather than a simple text interpolation:

- `1 -> 10+`
- `1 -> 120+`
- `0 -> 95%`
- duration 1s, easing `[0,0,.2,1]`, trigger when the individual counter reaches 20% intersection, once.

### gsap mapping

- use `gsap.fromTo(el, { autoAlpha: 0, y: 80 }, { autoAlpha: 1, y: 0, duration, ease: customEase })` with `ScrollTrigger` `start: "top bottom"`, `once: true`; do not add `scrub`.
- use `CustomEase` for the exact cubic curves if fidelity matters. approximate built-in eases will be visibly different on the slower 1s reveals.
- run triggers in document order and refresh after fonts/images settle. mobile height changes are large enough to expose stale trigger positions.
- the original does not honor a special custom reduced-motion design. the clone still should collapse transforms/durations under `prefers-reduced-motion` via `gsap.matchMedia()`.

## scroll behavior

### hero and navigation

- hero is `position: sticky; top: 0; height: 100vh; z-index: 1`. the following light sections cover it; there is no hero image scale, parallax, or opacity scrub.
- nav wrapper is `position: fixed; top: 0; z-index: 10`.
- at the exact point the about section reaches the top of the viewport (`scrollY === 100vh`; 900px in the desktop capture), nav switches from the light-on-hero variant to the dark-on-light variant. this is a state transition, not a color scrub.
- nav layout/color state uses 1s tween `[.23,.83,.56,1]`.

### services sticky stack

- every services card and the left services heading are `position: sticky; top: 160px` at all three breakpoints.
- desktop is a two-column stack: left intro at x80/w512, right cards at x630/w730, each 366px tall. cards begin 606px apart and overlap at the 160px pin line as the next one arrives.
- tablet and phone switch to a single column but keep the same `top: 160px` sticky behavior. tablet cards are 976x366; phone cards are about 358x627-650.
- there is no tween between cards. the effect is entirely natural scroll plus sticky overlap. preserve the document spacing and stacking order; adding scrubbed scale/fade would be inaccurate.

## hover, click, and persistent motion

### nav links and footer links

- each link contains duplicate text rows in a clipped container. hover changes the stack alignment to the second row, creating a vertical text swap.
- outer transition: 1s tween `[1,.06,.37,.82]`; inner text stack uses the same curve at .4s.
- no background pill, magnetic movement, or cursor follower.

### primary text-arrow links (`start a project`, cta button, footer `subscribe`)

- clipped 20px arrow slot holds two arrow svgs. hover sends the visible arrow up-right by about 20px while the replacement enters from down-left.
- the 1px underline is two very wide adjacent lines. its wrapper travels from roughly `left:-671px` to `left:0` (`-705px` for subscribe), producing a directional wipe.
- hero/cta transition is 1s `[1,.06,.37,.82]` with a .2s delay. footer subscribe is 1s with no delay.
- `see all works` uses only the same underline wipe, 1s `[1,.06,.37,.82]`, no arrow.

### project cards

- no image zoom, pan, blur, or custom cursor.
- hover expands the component's nominal height from 478px to 487px and changes the clipped metadata stack from top-aligned to bottom-aligned. this swaps `title / year` for `short description / year`.
- the short description changes from near-black to gray `#737373`.
- transition is spring `damping:60, mass:1, stiffness:200`; reverse uses the same spring.
- when the card is stretched by its outer grid container, the image keeps its size and the metadata row performs the visible movement.

### testimonial carousel

- carousel is manual only; there is no autoplay timer.
- arrow buttons are 40x40. hover removes the 1px border, fills black, and flips the arrow stroke from black to `#f2f2f2` with a .4s spring (`bounce:.2`).
- a click swaps a shared-layout testimonial variant rather than translating a long horizontal track. variant transition is a .3s spring with `bounce:.15` and `.3s` delay; newly shown quote text uses the .9s word reveal (`y:20`, opacity in, `[.44,0,.13,.96]`, 20ms offset).

### faq

- one item starts expanded; the rest start collapsed.
- clicking a row toggles its answer height and plus/minus geometry with spring `damping:40, mass:1, stiffness:200`.
- this is layout expansion, not opacity-only disclosure.

### mobile/tablet menu

- desktop shows the full nav. tablet and phone show the menu toggle and full-screen overlay.
- open/close layout transition is 1s `[.23,.83,.56,1]`; overlay link copy reveals per word over .9s using `[.44,0,.13,.96]` and a 20ms offset.
- opening blocks document scroll. closing restores it.
- hamburger/x lines use a .4s spring (`bounce:.2`): closed icon rotates the two 36px bars to `-25deg/+25deg`; open icon returns them to parallel. hovering the open icon shortens the lower bar from 36px to 24px and right-aligns it.

## responsive behavior

breakpoints are exact and should be mirrored with `gsap.matchMedia()` plus tailwind media queries:

- desktop: `min-width: 1200px`
- tablet: `810px <= width <= 1199.98px`
- phone: `max-width: 809.98px`

important layout/motion consequences:

- desktop section padding is generally `120px 80px`; tablet `80px 24px`; phone `80px 16px`.
- hero remains sticky and viewport-height everywhere. desktop/tablet content sits against the bottom with 40px bottom padding; phone uses 72px bottom padding and a 400px top pad.
- asymmetric project grid measurements:
  - 1440: `512x810`, `640x450`, `1062x630`, `640x450`, `512x810`
  - 1024: `488x540`, `390x270`, `810x450`, `390x270`, `488x540`
  - 390: `286x506`, `286x338`, `358x591`, `286x338`, `286x506`
- phone alternates project alignment: left, right, full, left, right. tablet/desktop preserve the staggered two-column composition.
- tablet overrides the project reveal/exit to a tighter spring (`damping:60, delay:.02, mass:1, stiffness:100`); desktop and phone retain the heavier spring listed above.
- section heights change substantially on phone (live page about 15,264px tall at 390x844 versus 10,736px at 1440x900), so scroll triggers must recalculate on breakpoint changes.

## motion that should not be invented

- no marquee
- no custom cursor
- no hero parallax or ken burns
- no image zoom on project hover
- no scroll-scrubbed fade/scale between service cards
- no testimonial autoplay
- no continuous page-transition overlay on the home route

## primary bundle evidence

- page/runtime/nav/faq/cta/footer: `script_main.D6Ab5ly-.mjs`
- home layout, lenis, counters, reveals, testimonials: `8DZM-AcioVK2l79mAjXPTYaz5K1hqpcnHVOk7DkAsSc.BjwH2O0x.mjs`
- project card hover: `GsDemCy3n.C5i6WsVn.mjs`
- primary text-arrow button: `bqUeMlAQB.DOgaWs2p.mjs`
- process/services section reveal: `Mwshwmlvd.DDn8QPcY.mjs`
