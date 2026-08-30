# forma studio recreation

- [x] capture desktop, tablet, and mobile reference screenshots
- [x] inventory page copy, media, fonts, colors, spacing, and component geometry
- [x] document hover, cursor, load, and scroll-driven motion behavior
- [x] scaffold next.js, typescript, tailwind css, gsap, and @gsap/react
- [x] implement the responsive page structure and visual styling
- [x] implement entrance, hover, menu, odometer, reveal, sticky, and scroll sequences in gsap
- [x] compare reference and local renders at matching viewports and iterate
- [x] verify reduced-motion behavior, console/network health, lint, typecheck, and production build

## review

- desktop geometry matches the 1440 x 900 reference at 10,736 px total height, including every section boundary
- phone geometry matches the 390 x 844 reference at 15,264 px total height, including every section boundary
- confirmed there is no source marquee, hero parallax, image zoom, or autonomous testimonial playback to recreate
- verified menu open/close and body lock, faq accordion state, testimonial navigation, project metadata hover, navigation roll, sticky hero/header, and stacked service cards
- verified 1024 px tablet rendering without horizontal overflow and confirmed the reduced-motion GSAP/CSS fallback path
- verified a fresh browser context has no console errors and all local requests return 200/304
- `npm run typecheck`, `npm run lint`, and `npm run build` pass
