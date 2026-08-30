# forma studio reference audit

audited on 2026-08-30 from the live page at [formastudio.framer.ai](https://formastudio.framer.ai/). evidence came from the server-rendered html/css, the published framer page bundle, and headless chrome at 1440 x 813 and 390 x 844 css pixels. the live page says it was published jul 21, 2026 at 2:55 pm utc.

the downloaded files in [`reference/assets`](./assets/) are optimized copies of the exact public reference assets, not replacements or lookalikes. the two `forma-*-top.png` files are reference screenshots.

## page skeleton

the desktop page measured 10,432 px tall at a 1440 x 813 viewport. the mobile page measured 15,264 px tall at 390 x 844. the source breakpoints are exact:

- desktop: `min-width: 1200px`
- tablet: `810px` through `1199.98px`
- phone: `max-width: 809.98px`
- desktop content max-width: `1440px`; side padding `80px`
- tablet side padding: `24px`
- phone side padding: `16px`

desktop section order and measured geometry:

| section | document y | height | background / important layout |
|---|---:|---:|---|
| hero | 0 | `100vh` / 813 | sticky at `top: 0`; full-bleed image, `brightness(.5)` |
| about | 813 | 667 | `#f2f2f2`, `120px 80px` |
| projects | 1480 | 2695 | `#f2f2f2`, `120px 80px` |
| services | 4175 | 2424 | `#0f0f0f`, `120px 80px` |
| process | 6599 | 1114 | light, `120px 80px` |
| testimonials | 7714 | 678 | `#f2f2f2`, `120px 80px` |
| faq | 8391 | 739 | light, `120px 80px` |
| cta | 9130 | 640 | full-bleed image, `brightness(.4)` |
| footer | 9770 | 661 | `#0f0f0f`, `80px 80px 0` |

the equivalent phone heights at 390 x 844 are: hero 844, about 1100, projects 3157, services 3649, process 3064, testimonials 818, faq 995, cta 640, footer 997.

## exact content and layout

### header and hero

- fixed header: 72 px tall initially, transparent, `20px 80px`; logo left, five links centered, email/phone right.
- links: home, about, projects, services, contact. right copy: `hello@studio.com` and `(+91) 114 567 8900`.
- after the about boundary crosses the viewport, the header morphs to a 69 px `#f2f2f2` bar containing the dark logo and hamburger. opening it creates a full-viewport menu with social links, the studio description, large nav links, email, and phone.
- hero image fills `100vw x 100vh`, `object-fit: cover`, `object-position: center`, filter `brightness(.5)`.
- desktop content container is also `100vh`, with `padding: 526px 80px 40px`; phone uses `padding: 400px 16px 72px`.
- supporting copy is 296 x 67 px desktop and 288 x 67 px phone: `We design spaces that are simple, functional, and thoughtfully planned to improve how you live and work.`
- link: `Start a Project` with a northeast arrow and underline.
- bottom wordmark is `Forma Studio®`; desktop box is 1280 x 199 at x 80, phone is 358 x 54 at x 16 and intentionally crops the wordmark at the right edge.

### about

- label: `About Us` with a 10 px pulsing dot.
- main copy: `We are a design studio focused on crafting calm, intentional interiors that balance aesthetics, functionality, and everyday living.`
- desktop copy starts at x 515, is 845 x 211, and occupies 66% of the content width; the label occupies the left third.
- three count-up stats: `10+ Years of Experience`, `120+ Completed Projects`, `95% Client Satisfaction`. each runs for 1 second with the source's `smooth` easing when entering view.
- phone stacks the stats with 32 px gaps; the block is 358 x 473.

### projects

- label: `Projects`
- heading: `Selected Work`
- supporting line: `A collection of spaces defined by simplicity and intention.`
- desktop is an intentionally asymmetric editorial collage. measured card boxes:

| project | x / y within document | card size | image size |
|---|---|---|---|
| horizon villa | 80 / 1838 | 512 x 732 | 512 x 702 |
| linear workspace | 720 / 2061 | 640 x 407 | 640 x 377 |
| studio minimal | 189 / 2650 | 1062 x 569 | 1062 x 539 |
| concrete house | 80 / 3401 | 640 x 407 | 640 x 377 |
| axis office | 848 / 3299 | 512 x 732 | 512 x 702 |

- every card shows the title and `2026`. its hidden hover row says `Urban Apartment Interior` and `2026`.
- hover rolls the first metadata row upward and the second row into the clipped 22 px metadata strip. the image itself does not scale or filter on hover.
- phone keeps the asymmetry: widths are 286, 286, 358, 286, 286 px; rows alternate x 16 and x 88. heights are 506, 338, 591, 338, 506 px.
- footer link: `See All Works` with a left-to-right underline wipe.

### services

- label: `Services`; heading: `What we design`.
- supporting line is intentionally the same process sentence used elsewhere: `We follow a clear process to keep every step simple, structured, and easy to manage.`
- desktop uses a sticky 40% left introduction (`top: 160px`) and a 57% right column. the right column has `gap: 240px` and each service card container is itself sticky at `top: 160px`, producing the signature card-stacking scroll effect.
- desktop service cards are 730 x 366 at 1440 px. they use 16 px padding and 16 px internal gap; image area is 341 x 334. phone cards are full 358 px wide, become vertical, and are 627-650 px tall.
- cards:

| no. | title | description | detail line |
|---|---|---|---|
| /01 | interior design | we design interiors that are simple, functional, and aligned with how the space is used every day. | layout planning · material selection · furniture guidance |
| /02 | architecture | we create structures that are practical, well-planned, and built to last. | concept design · floor plans · working drawings |
| /03 | space planning | we organize layouts to improve flow, usability, and overall efficiency. | zoning layout · circulation flow · space optimization |
| /04 | renovation | we update existing spaces to improve layout, function, and overall usability. | site assessment · layout updates · material upgrades |

### process

- label: `Process`; heading: `How We Work`; same supporting process sentence; `Start a Project` link.
- desktop grid: four equal columns x two 320 px rows, 8 px gap. cards and portrait images alternate in a checkerboard. at 1440 px each cell is 314 x 320.
- tablet changes to two columns. phone becomes one column, alternating each 320 px card with a 320 px image.
- copy:

| no. | title | description |
|---|---|---|
| /01 | discover | we understand your vision, lifestyle, and spatial requirements. |
| /02 | concept | we define the layout, atmosphere, and overall design direction. |
| /03 | developement | we refine materials, lighting, furniture, and spatial details. |
| /04 | execution | we execute the design with consistency and attention to detail. |

`Developement` is misspelled in the source and should remain so for strict fidelity.

### testimonials

- label: `Testimonials`; heading: `What Our Client Say`.
- desktop content is a 65% quote column plus a 30% ratings/actions column. avatar is 40 x 40.
- testimonials cycle with previous/next 40 px square arrow controls:
  - emma carter, homeowner: `"The design decisions were practical and well thought out, making the space easy to use and maintain."`
  - james bennett, property developer: `"The team maintained clarity at every stage, resulting in a space that feels simple, functional, and complete."`
  - lucas turner, restaurant owner: `"Communication remained consistent throughout, and the execution was handled smoothly without delays."`
- rating copy: `4.9/5` and `Rated by 1200+ Verified Clients`, with five 14 px stars.

### faq, cta, and footer

- faq heading: `Your Questions, Answered`; support: `Find quick answers to the most common questions about our services and process.`
- five accordion items; first starts expanded. desktop accordion width is 51% of the content row, each row uses `24px 12px` padding. the expanded/collapsed transition is a spring with damping 40, mass 1, stiffness 200.
- faq copy:
  - how long does a project take? most projects are completed within 4 to 12 weeks, depending on scope and requirements.
  - what services do you offer? we provide interior design, architecture, space planning, and renovation services.
  - do you handle both residential and commercial projects? yes, we work on a range of residential and commercial spaces tailored to client needs.
  - what is included in the design process? the process typically includes consultation, concept development, space planning, material selection, and final documentation.
  - how do we get started? simply get in touch through our contact form, and we'll schedule an initial consultation.
- cta: `Ready to Elevate Your Space?`, `Let’s create something memorable together`, `Start a Project`; 640 px fixed section height at every breakpoint. heading is centered in a 718 px box on desktop.
- footer signup title: `Studio Insights & Updates`, input + `Subscribe`. columns repeat the nav, twitter/instagram/linkedin, contact details, `New Delhi, India`, privacy policy, terms & conditions, and `Made by Hariom`. bottom uses the giant `Forma Studio®` wordmark.

## exact visual tokens

- page body behind the hero: `#0d0d0d`
- primary light surface and light text: `#f2f2f2`
- primary dark surface and dark text: `#0f0f0f`
- supporting gray: `#737373`
- muted light-on-dark: `#b5b5b5`
- secondary gray: `#8a8a8a`
- process/card borders: `#2a2a2a`, 1 px solid
- other published tokens available if needed: `#d9d9d9`, `#0a0a0a`, `#141414`, `#f5f5f5`, `#ffffffb3`, `#0a0a0ab3`

primary type is mona sans. the actual styles used most often:

- display h1: 60 px desktop/tablet, 48 px phone, weight 500, line-height 1.1, tracking `-.04em`
- h2: 48 px desktop, 40 px tablet/phone, weight 500, line-height 1.1, tracking `-.04em`
- cta display: 76 px desktop/tablet, 60 px phone, weight 500, line-height 1, tracking `-.04em`
- h3: 32 px / 500 / 1.2 / `-.04em`
- h4: 24 px / 500 / 1.2 / `-.04em`
- h5: 20 px / 500 / 1.2 / `-.02em`
- body: 16 px / 400 / 1.4
- small label: 14 px / 400 / 1.4
- project metadata and buttons: 16 px / 500 / 1.4

latin mona sans files used by the bundle:

- 400: `https://fonts.gstatic.com/s/monasans/v4/o-0mIpQmx24alC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99Y41P6zHtY.woff2`
- 500: `https://fonts.gstatic.com/s/monasans/v4/o-0mIpQmx24alC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyDPA99Y41P6zHtY.woff2`
- 700: `https://fonts.gstatic.com/s/monasans/v4/o-0mIpQmx24alC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyAaBN9Y41P6zHtY.woff2`

the bundle also loads geist 400 and inter 400/500/600, but visible branded typography is mona sans; inter is mainly a framer/internal fallback and the footer input declares inter.

## motion contract to reproduce in gsap

these values are taken from the published motion config, not guessed:

- hero group: opacity `.001` + `y: 80` to opacity 1 + `y: 0`, 1 second, cubic bezier `[.23, .83, .56, 1]`.
- hero/about/testimonial word reveals: tokenize by word, each word starts at opacity `.001`, `y: 20`; duration 1 second for hero/about and `.9s` for testimonial; stagger/delay `.02s`; cubic bezier `[.44, 0, .13, .96]`.
- about entrance: opacity 0 + `y: 80`, `.5s`, cubic bezier `[.23, .83, .56, 1]`.
- project heading, services section, testimonials, faq, cta, and footer groups: opacity 0 + `y: 80`, 1 second, cubic bezier `[.23, .83, .56, 1]`, trigger once at the viewport boundary.
- project cards: opacity 0 + `y: 80` using framer spring `{ damping: 30, mass: 5, stiffness: 40 }`. tablet overrides with `{ damping: 60, delay: .02, mass: 1, stiffness: 100 }`.
- nav hover: duplicated labels inside a 24 px clipping box; roll the first out and second in. outer duration 1 second, inner duration `.4s`, cubic bezier `[1, .06, .37, .82]`.
- primary text-arrow links and footer subscribe: the northeast arrow exits up/right while its duplicate enters from down/left; underline performs a full wipe. duration 1 second, cubic bezier `[1, .06, .37, .82]`.
- `See All Works`: 1 second underline wipe with the same `[1, .06, .37, .82]` ease.
- mobile/tablet menu icon: two 36 x 2 px lines, closed variant rotates to `-25deg/+25deg`; hover shortens one line to 24 px. transition is a `.4s` spring with bounce `.2`.
- header state change: keep the header fixed. use scrolltrigger at the about boundary to morph from the transparent 72 px full nav to the light 69 px logo/hamburger bar. the open overlay's inner content is exactly `100vh` and the source transition uses spring motion.
- service stacking: do not fake this as a basic reveal. keep the intro sticky at 160 px and each right-side card sticky at 160 px, with 240 px flow gaps, so subsequent cards naturally stack over earlier ones.
- testimonial change: layout spring `{ bounce: .15, delay: .3, duration: .3 }` plus the `.9s` word reveal above.
- faq: animate answer height from 1 px to auto and rotate/change the plus state with spring `{ damping: 40, mass: 1, stiffness: 200 }`.
- the source dot indicator is 10 px: solid core plus a translucent same-color ring running `pulse 1.5s infinite`.
- respect `prefers-reduced-motion`: show final states and disable sticky scrub/word staggering.

## exact public image assets

all content images use `object-fit: cover` and centered positioning unless noted.

| use | local optimized copy | original public url | source dimensions |
|---|---|---|---:|
| hero | `hero-interior.png` | `https://framerusercontent.com/images/dbPAzHQotBtcCD0MbsaCTyiCRw.png` | 1344 x 768 |
| horizon villa | `project-horizon-villa.jpg` | `https://framerusercontent.com/images/YbAB2Zbkg9jLtj34VXnRPCPs5LA.jpg` | 5824 x 3264 |
| linear workspace | `project-linear-workspace.jpg` | `https://framerusercontent.com/images/e8xozRZiErMlhLQSztV5ZhuoK0.jpg` | 7280 x 4080 |
| studio minimal | `project-studio-minimal.jpg` | `https://framerusercontent.com/images/ONYz4iIYbtdBfWvjug3Cjbwk.jpg` | 6067 x 3467 |
| concrete house | `project-concrete-house.jpg` | `https://framerusercontent.com/images/qgkeTd2DmO7jPFnL7lN5AdwGn0Q.jpg` | 1344 x 768 |
| axis office | `project-axis-office.png` | `https://framerusercontent.com/images/6ltlDd0rq7brBmSRfKk8p6hccDk.png` | 1344 x 768 |
| interior design | `service-interior-design.jpg` | `https://framerusercontent.com/images/zU3HOItMDdrHrp9nQlfada9w41g.jpg` | 3584 x 5376 |
| architecture | `service-architecture.jpg` | `https://framerusercontent.com/images/4HdNPHeshnkG748ciAYklMARsaQ.jpg` | 3584 x 5120 |
| space planning | `service-space-planning.jpg` | `https://framerusercontent.com/images/AxJRQhgdpdEolEEQ1H3ohj5HU.jpg` | 5376 x 3584 |
| renovation | `service-renovation.jpg` | `https://framerusercontent.com/images/T73RDzY4YTBKLYXBFOZe8f6QCMQ.jpg` | 3584 x 5376 |
| discover | `process-discover.png` | `https://framerusercontent.com/images/9ZEWbgBycN2aHtECMXqUOq0uu8.png` | 1024 x 1536 |
| concept | `process-concept.png` | `https://framerusercontent.com/images/1MIUzNN1XNO3YCtFwqtUiuqpdZ4.png` | 1024 x 1536 |
| developement | `process-development.png` | `https://framerusercontent.com/images/cE5088JgyaKuK3KY2hltZ5Bz1yI.png` | 1024 x 1536 |
| execution | `process-execution.png` | `https://framerusercontent.com/images/hyb4eTno1ijqnjwVrSlfbzqd8l8.png` | 1024 x 1536 |
| emma | `testimonial-emma.jpg` | `https://framerusercontent.com/images/5oV34Py33copHWuSi1cNeJBxMWY.jpg` | 5456 x 3660 |
| james | `testimonial-james.jpg` | `https://framerusercontent.com/images/mrFa6YEoOnAd0HKlUP7xIufmHjw.jpg` | 5152 x 7728 |
| lucas | `testimonial-lucas.jpg` | `https://framerusercontent.com/images/lWwBQSfqX5vUZFT248dCZFpU.jpg` | 4000 x 6000 |
| cta | `cta-building.jpg` | `https://framerusercontent.com/images/WC6lU6Cq8jTS9FM3qLuwPfGn0.jpg` | 4096 x 4096 |

there are no video assets on this landing page.

## fidelity traps

- the hero is sticky and later light sections scroll over it; a normal static hero will feel wrong even if the first screenshot matches.
- the header collapses only after the about boundary. it is not a permanently visible white navbar.
- the project collage uses viewport-proportional widths and deliberately offset rows; a uniform card grid will miss most of the character.
- the services sequence is driven by nested sticky positioning and large flow gaps, not scroll pinning a single replacement card.
- the giant hero/footer wordmarks are vectorized in the source. recreating them as mona sans text is acceptable, but letter spacing and right-edge crop need manual visual tuning.
- retain the source copy quirks (`Developement`, `What Our Client Say`, and the repeated process sentence) for literal 1:1 output.
