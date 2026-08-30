# capy system sticker manifest

all eight source illustrations were generated with `nano_banana_2_lite` from `public/kawaii/logo-sticker.png` at `1:1`, `1k`, and `HIGH` thinking. nano banana rendered a checkerboard into the source canvas, so the final files were passed through higgsfield's `image_background_remover` and visually checked on both peach and dark-green solid backgrounds.

## delivery qa

- canvas: 1024 × 1024 png
- color mode: rgba
- alpha: genuine transparent pixels (`0–255` alpha range), not a baked checkerboard
- composition: one centered, readable object with generous clear margin
- styling: warm cream/brown, mint, sky-blue, peach, and orange fills; thick dark-green ink; white die-cut keyline; dark offset shadow
- content: no letters, words, numbers, or accidental logo text

## assets

| file | generated source | transparent delivery | qa notes |
| --- | --- | --- | --- |
| `robot-gripper.png` | [source](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203557_f9a5ac1b-f4bc-4194-8289-4bfb39f9b5b0.png) | [delivery](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203947_61ea3433-a63d-43e7-ae65-6ab4687b767d.png) | unmistakable mint robot arm and two-pincer gripper holding an orange bolt; strong silhouette; transparent inner pincer opening; keyline and lower-right shadow retained. |
| `capability-receipt.png` | [source](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203632_295ccfab-43fb-494e-922c-751eaa973c3b.png) | [delivery](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203947_e07c1efe-efea-4826-8bc2-11c7028465e9.png) | curled receipt mini-character reads clearly at small sizes; gear, cloud, and verified-star icons are text-free; scalloped edge and shadow are clean. |
| `verified-star.png` | [source](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203632_22099295-f534-44ba-b135-5da0eb05c491.png) | [delivery](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203947_8ebe85b4-490a-4a5d-bc36-3b3e37051676.png) | strongest simple badge in the set; mint star, orange check, face, keyline, and down-right shadow remain crisp on light and dark backgrounds. |
| `data-capsule.png` | [source](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203632_b9956e51-79b1-431b-8013-6b0bc0a12f38.png) | [delivery](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203947_06ba2b1c-ee3d-407e-9c42-782dc4437171.png) | clear capsule/vial silhouette with three mint, blue, and orange data beads; glass highlights and facial details survived background removal. |
| `simulation-cube.png` | [source](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203633_02d8504b-0ed6-4569-ad02-8295cba5dac2.png) | [delivery](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203947_f411abcd-b0d3-42c7-9cbc-52c9bfe3071c.png) | isometric simulation cube is immediately legible; tiny orange capybara pawn and mint grid remain intact; outer silhouette is clean. |
| `contributor-token.png` | [source](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203632_6928ea2a-d17f-4c12-ae97-fb24087c2c0f.png) | [delivery](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203947_4e2f0855-7701-44ba-9f39-7282d2bb1627.png) | round token reads well as a badge; centered capybara relief, orange notch, and mint sparkle accents are all clean and text-free. |
| `failure-signal.png` | [source](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203632_bf5f8bd7-64f4-402e-a5ee-82bc2a1aebb4.png) | [delivery](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203947_97fc9001-8606-417e-8732-17ed70690f53.png) | orange warning beacon and lightning rays are unmistakable; worried mini-character expression communicates failure without text. |
| `telemetry-antenna.png` | [source](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203633_d36e35f1-03b2-47dc-8fd1-6dc2835c3bbb.png) | [delivery](https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203947_ffdb982e-1016-43b9-9bae-7589863cbac9.png) | antenna, orange tip, blue signal arcs, and mint tripod mini-character are clean; dedicated background removal eliminated the source's colored checker noise. |

## local paths

the delivery files live beside this manifest in `public/kawaii/stickers/` and are ready for direct use through `/kawaii/stickers/<filename>`.
