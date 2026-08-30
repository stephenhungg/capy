# capy kawaii redesign

- [x] audit the product, current landing page, and existing visual system
- [x] lock the mascot identity, palette, prop language, and rendering rules
- [x] generate and select the logo/mascot ground truth
- [x] generate a large consistent asset family from the selected reference
- [x] curate, name, optimize, and document the selected assets
- [x] restore the original forma studio structure, pacing, and motion system
- [x] reskin forma with white, one capy accent color, and the generated assets
- [x] update copy without replacing the existing section architecture
- [x] verify desktop, tablet, mobile, reduced motion, console, lint, typecheck, and production build

## review

- restored the original forma studio section order, sticky hero, asymmetric project collage, sticky service stack, checkerboard process, carousel, faq, cta, and oversized footer
- constrained the interface to white, black/gray neutrals, and one capy orange accent (`#ff8a2a`)
- generated 29 capy png assets total, including 6 poses, 8 transparent system stickers, 6 workflow scenes, hero/network art, logo work, and app icon
- desktop page height is 10,578 px against the original 10,736 px target; mobile is 15,388 px against the original 15,264 px target
- verified no horizontal overflow at 1440 px or 390 px, no console errors, all 14 rendered images loaded, gsap scroll progress reaches 0→1, menu body lock works, and carousel/faq interactions update correctly
- `npm run typecheck`, `npm run lint`, and `npm run build` pass
