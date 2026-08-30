# capy mascot pose pack

reference: `public/kawaii/logo-sticker.png`

model: `nano_banana_2_lite`

all deliverables are normalized to 1024 × 1024 rgba pngs on a true transparent canvas. the original higgsfield renders used a visible checkerboard treatment despite the transparency request, so the connected border background was removed deterministically after download. no application source was changed.

| file | higgsfield source | qa notes |
| --- | --- | --- |
| `mascot-wave.png` | https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_204158_5d4182b3-d5c4-4d26-8499-740b2f3592cf.png | friendly full-body wave; clean silhouette; cream muzzle, blush, mint vest, orange badge, white keyline, and dark offset shadow present; no text |
| `mascot-inspect-tablet.png` | https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203526_95e37428-9460-4f89-bd2c-f51a23275cef.png | focused smile while inspecting an orange capability tablet; full body and sticker treatment preserved; no readable text |
| `mascot-carry-data.png` | https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203526_c5551bde-5189-4873-abd6-57a04491d44b.png | glowing blue capsule held in both paws; badge glyph was normalized to the reference-style single circle so no accidental lettering remains |
| `mascot-celebrate.png` | https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203526_eff966f8-1112-4c19-b422-36a32df3e171.png | raised-paw celebration with verified check-star and restrained orange/blue confetti; centered full body; no text |
| `mascot-point.png` | https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203749_aea9e1c3-f740-4d0a-9191-c58bd545cb4f.png | rerolled to remove an invented speech-bubble frame; mascot stays left and points into genuinely empty transparent right-side copy space |
| `mascot-repair.png` | https://d8j0ntlcm91z4.cloudfront.net/user_3DHsPC6OCpyUmzAQPLHPaZStjet/hf_20260830_203526_0147da47-b422-41f8-999a-3af420a2b8ec.png | kneeling repair pose with orange-handled wrench and friendly blue robot gripper; full sticker silhouette preserved; no text |

## final qa

- dimensions: 1024 × 1024 for every png
- alpha: 0–255 range present for every png
- canvas borders: fully transparent on every png
- palette: cocoa brown, cream, blush pink, mint, orange, blue accent, dark green, and white only
- composition: full character visible in every pose; the pointing pose intentionally reserves the right half for copy
- visual review: passed as a six-up contact sheet on a light background
