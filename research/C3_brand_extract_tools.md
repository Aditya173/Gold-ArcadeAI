# C3: Tools that extract a brand or style from images

*Background research, sources checked 2026-10-11. "Reported" means a reviewer's or user's
account, not a reproduced defect. **UNSOURCED** marks hypotheses and capability gaps that could
not be substantiated.*

## Findings

- **No tool documents "many personal photos → one identity".** Coolors and Adobe Color read one
  image. Canva's Brand Kit Builder reads a website or PDF. Khroma learns from 50 colours a person
  picks, not from photos. **Adobe Express** is closest: it can extract a brand from several
  images, a feature labelled beta. **Recraft V4** is closest for "reference style → new visuals"
  (1–10 references). Recraft itself warns that mismatched references blend into conflicting motifs,
  and that exact colour is not guaranteed.
- **Material You's colour scorer is built for UI themes, not identity.** It filters out near-greys
  and falls back to Google Blue. Its top colour is not "this person's colour".
- **Arcade documents image prompting, but no multi-photo identity model.** A 2024 TechCrunch
  hands-on reported failures on multiple necklace charms and a complex 20-sided die. Simple pieces
  are safer.
- **The complaints below are anecdotes** (Reddit, App Store, competitor tests), not measured
  failure rates.
- **UNSOURCED:** that a multi-photo approach beats a single-photo palette. The fair test is a
  single-photo baseline plus an "all photos in one prompt" baseline, along with a check that the
  result stays stable when duplicates or backgrounds change.

## Palette extraction

| Tool / method | Reads → outputs | One photo or many | Reported limits |
|---|---|---|---|
| Coolors Image Picker. [Help](https://coolors-help.zendesk.com/hc/en-us/articles/360010537260-Create-a-palette-from-a-photo) | One image → an editable palette | One at a time ([comparison](https://toolboximage.com/toolbox-vs-coolors/)) | A competitor says it missed a small yellow accent. [ColorSense](https://colorsense.online/blog/free-color-palette-generators-compared/) |
| Adobe Color. [Extractor](https://color.adobe.com/create/image) | One image → a palette with moods (Colorful, Muted …) | One | Users expected edits to recolour the photo; they don't. [Discussion](https://community.adobe.com/questions-194/color-grading-wheels-etc-294967) |
| Material You / material-color-utilities. [Architecture](https://github.com/material-foundation/material-color-utilities/blob/main/concepts/color_extraction.md) | Image → quantised colours → ranked source colour → UI tonal palettes | One image helper ([code](https://github.com/material-foundation/material-color-utilities/blob/main/typescript/utils/image_utils.ts)) | Scores suitability for UI. Filters greys; falls back to Google Blue. [Score](https://github.com/material-foundation/material-color-utilities/blob/main/typescript/score/score.ts) |
| k-means. [scikit-learn](https://scikit-learn.org/stable/auto_examples/cluster/plot_color_quantization.html) | Pixels → k cluster centres | Pooling photos is possible, but the weighting is up to you | People rate a human-trained model's palettes as more representative than k-means. [CHI 2013](https://doi.org/10.1145/2470654.2466424) |
| Median cut. [Heckbert](https://www.cse.iitd.ac.in/~pkalra/col783-2017/p297-heckbert.pdf) | Colour-space boxes → averages | One image (Pillow `quantize`) | No RGBA support in Pillow's median cut. [Pillow](https://pillow.readthedocs.io/en/stable/reference/Image.html#PIL.Image.Image.quantize) |

## Brand kits and reference-style generation

| Tool | Reads → outputs | Many images? | Reported limits |
|---|---|---|---|
| Canva Brand Kit Builder. [Help](https://www.canva.com/help/brand-kit-builder/) | Website or PDF → colours, fonts, voice | Not from a camera roll | Fails on blocked sites and complex PDFs |
| Looka. [Brand Kit](https://looka.com/brand-kit/) | A logo → colours, fonts, templates | Photos are not analysed together | Limited customisation. [TechRadar](https://www.techradar.com/reviews/looka-logo-maker) |
| Khroma. [Train](https://www.khroma.co/train) | 50 chosen colours → a personal generator | Explicit picks, not photos | Colours you leave out are treated as disliked. [Creative Bloq](https://www.creativebloq.com/how-to/generate-endless-colour-palettes-with-khroma) |
| Brandmark. [Generator](https://chat.brandmark.io/generate) | Name + keywords → a logo kit | No | Templated results. [Review](https://makerstack.co/reviews/brandmark-review/) |
| Adobe Express. [Help](https://helpx.adobe.com/uk/express/web/brands-libraries-projects/create-manage-brands/brand-setup.html) | Several images + a name → palettes, fonts, logos (beta) | **Yes** | Weighting and accuracy on personal photos UNSOURCED |
| Recraft V4 Styles. [Guide](https://www.recraft.ai/blog/v4-styles-the-ultimate-field-guide) | 1–10 references + a prompt → new images | Yes | Mismatched references conflict; colour not exact |

## Moodboards and taste

| Tool | What it does | Note |
|---|---|---|
| Cosmos. [Intro](https://help.cosmos.so/en/articles/11846092-intro-to-cosmos) | Collections, similar-image search, a personal feed | No exported identity profile |
| Are.na. [Channels](https://help.are.na/docs/getting-started/channels) | Blocks in hand-made channels | States it has no personalised recommendations |
| Pinterest. [Boards](https://newsroom.pinterest.com/news/pinterest-boards-get-ai-powered-upgrade-for-personalized-experience/) | Visual search, board recommendations, "Styled for you"; Ask Pinterest, built on its Taste Graph ([2026](https://newsroom.pinterest.com/news/cannes-2026/)) | Uses saves, searches and browsing: signals of preference, not photos taken |
| Milanote. [Template](https://milanote.com/templates/branding/brand-personality) | Boards plus an exercise to pick brand adjectives | Manual |

## Photos → physical products

| Channel | What it does | Reported limits |
|---|---|---|
| Arcade. [Studio](https://studio.arcade.ai/) | Text or image prompts → maker-built goods, made on demand | Multi-charm and complex-die failures. [TechCrunch 2024](https://techcrunch.com/2024/10/27/arcade-a-new-ai-product-creation-platform-designed-this-necklace/) |
| Printify. [AI](https://help.printify.com/hc/en-us/articles/15493218417809-How-can-I-design-a-product-using-Printify-s-AI-Image-Generator) | Prompt → 1024×1024 image on a product; buyer-uploaded personalisation | Some print methods mute bright colours |
| Printful. [Colour disclaimer](https://help.printful.com/hc/en-us/articles/50264401675665-Color-Matching-Disclaimer) | Uploads → mockups and products | No guaranteed colour match; desaturation on dark garments |
| Zazzle. [Design tool](https://www.zazzle.com/hc/article/basic_design_tool_functionality_adding_images_text-115004604127) | Upload and arrange layers | Reports of dull colours |
| Mixbook. [Auto-Create](https://help.mixbook.com/hc/en-us/articles/61128856919577-How-do-I-use-the-Auto-Create-feature) | Many photos → an auto-filled book | Extra photos are silently left unplaced |
| Journi. [About](https://www.journiapp.com/e/wijai/) | Up to 1,200 photos → a chronological book with maps | No map without location metadata |
| Etsy custom sellers. [Example](https://www.etsy.com/listing/1874142250/personalized-embroidered-pet-portrait) | Photo → a commissioned piece with a proof | One seller takes several photos but works from one |

## Failure modes to design against

The evidence for each failure is sourced. **Every remedy is UNSOURCED design guidance.**

| Failure | Evidence | Proposed remedy |
|---|---|---|
| One photo dominates the palette | Single-image tools (above) | Normalise each photo's weight; dedupe bursts; test by adding duplicates |
| Skin, sky and walls swamp the chosen colours | Vendor warnings ([MakeMyPalette](https://www.makemypalette.com/palette-from-image)); [CHI study](https://doi.org/10.1145/2470654.2466424) | Weight clothing and objects above background; test one outfit on different backgrounds |
| Mixed photos average into mush | Recraft's warning | Cluster first; offer 2–3 directions |
| Generic adjectives | Brandmark and Milanote work from adjectives | Turn them into constraints: material, motif, finish, palette roles, exclusions |
| Photographed ≠ liked | Pinterest and Khroma use explicit preference signals | Ask the person; separate "photographed", "like", "own" and "want" |
| A palette with no roles | [Canva themes](https://www.canva.com/help/color-palettes/), Material roles | Primary, supporting, accent and neutral roles, with proportions |
| Style match ≠ colour match | Recraft | Keep the approved hex values separate from style references |
| The preview fails in print | [Printful files](https://help.printful.com/hc/en-us/articles/50264003313041-Should-I-use-RGB-or-CMYK-for-Printful-print-files) | Check resolution, substrate and the maker's colour rules before checkout |

**Output shape worth copying (UNSOURCED):** an evidence profile (contributing photos and
disagreements) → an editable design spec (colour roles, materials, motifs, exclusions) → a
product spec (placement, method, proof). Each stage can be corrected on its own.
