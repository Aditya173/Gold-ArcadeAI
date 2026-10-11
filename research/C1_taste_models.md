# C1: Models for taste and aesthetics from photos

*Background research, sources checked 2026-10-11. Public models, papers and licences only. It
does not say which models, if any, this project uses. **UNSOURCED** means no supporting public
evidence was found. It does not mean the claim is false.*

## Findings

- **Image encoders turn a photo into a vector, so photos can be compared.** Several open ones
  carry commercial-friendly licences (OpenCLIP, DINOv2, EVA02-CLIP). Read the model card as well
  as the licence tag. The LAION OpenCLIP cards say deployed use, "commercial or otherwise", is out
  of scope, even though the licence tag is MIT.
- **Some of the fastest phone encoders cannot ship.** Apple's MobileCLIP / MobileCLIP2 weights are
  research-only, with "No commercial/product development". That holds even though they encode an
  image in a published 1.5 ms on an iPhone 12 Pro Max.
- **Generic aesthetic predictors (LAION aesthetic head, NIMA, MUSIQ, Q-Align) predict the crowd's
  average liking, not one person's taste.** They also mostly re-read technical quality. PARA
  reports that aesthetics and quality correlate at PLCC 0.89 (PLCC is a straight-line correlation,
  where 1.0 means they move together perfectly).
- **Taste = generic score + a personal offset.** PAM (ICCV 2017) models exactly this: a
  general-purpose aesthetic score, then a small per-person correction learned from that person's
  own ratings.
- **How personal is taste?** Vessel et al. measured how well one person agrees with the crowd
  (mean Pearson correlation; 1.0 would be full agreement): 0.25 ± 0.16 SD for artworks, 0.64 ±
  0.19 for landscapes, and 0.40 for architecture. In plain terms, taste in art is mostly a
  person's own, while taste in landscapes is mostly shared. These are measurements in specific
  domains, not a universal percentage.
- **Personalisation gains are small and fragile.** PARA's MobileNetV2 baseline moves SROCC (a rank
  correlation with the person's own ratings) 0.6696 → 0.6697 → 0.6814 with 0, 10 and 100 of the
  user's examples. On LAPIS, SROCC falls from about 0.70 to about 0.28 when it is tested on users
  the model has never seen. Any claim about personal taste needs a test on held-out people.
- **Style embeddings describe style, not liking.** Gram matrices and CSD capture colour, texture
  and rendering. CSD beats Gram on style retrieval (WikiArt top-1: CSD-L 64.56%, VGG-Gram 25.9%),
  but neither is trained on what anyone prefers.
- **UNSOURCED, and the key caution:** "the camera roll shows what someone likes". Photographing
  something is not evidence of liking it. A taste claim needs the person's own picks to grade it.

## Encoders and aesthetic predictors

| Model | What it measures | Licence → commercial use | Size | Phone evidence |
|---|---|---|---|---|
| OpenCLIP ViT-B/16, LAION-2B | Image/text embeddings. [Card](https://huggingface.co/laion/CLIP-ViT-B-16-laion2B-s34B-b88K) | MIT, with the deployment caveat above | 86.2M image + 63.4M text. [Paper](https://arxiv.org/pdf/2311.17049) | 11.5 ms image encoding, iPhone 12 Pro Max, Core ML. [Paper §5](https://arxiv.org/pdf/2311.17049) |
| OpenCLIP ViT-L/14, LAION-2B | Same. [Card](https://huggingface.co/laion/CLIP-ViT-L-14-laion2B-s32B-b82K) | MIT, same caveat | ~304M image / 428M full | ViT-L/14 reference 57.9 ms (DFN weights). [Ref](https://arxiv.org/pdf/2508.20691) |
| DINOv2 ViT-S/14 | Self-supervised visual features. [Repo](https://github.com/facebookresearch/dinov2) | Apache-2.0 → yes. [Licence](https://github.com/facebookresearch/dinov2/blob/main/LICENSE) | 21M; 88.2 MB FP32 | Community Core ML export; iPhone latency UNSOURCED. [Export](https://github.com/VimalMollyn/dinov2-coreml) |
| DINOv3 ViT-S/16 | Self-supervised global and dense features. [Repo](https://github.com/facebookresearch/dinov3) | Custom licence, conditional. [Terms](https://github.com/facebookresearch/dinov3/blob/main/LICENSE.md) | 21M; community Core ML 41.7 MB FP16 | iPhone latency UNSOURCED |
| EVA02-CLIP B/16, L/14 | CLIP-style similarity. [Repo](https://github.com/baaivision/EVA/tree/master/EVA-CLIP) | MIT. [Licence](https://github.com/baaivision/EVA/blob/master/LICENSE) | 149M / 428M full | Apple could not reliably benchmark B/16. [Paper](https://arxiv.org/pdf/2311.17049) |
| Apple MobileCLIP-S0 / MobileCLIP2-S0 | Image/text embeddings. [Repo](https://github.com/apple-aiml-research/ml-mobileclip) | Code MIT; **weights research-only**. [Terms](https://huggingface.co/apple/MobileCLIP-S0/blob/main/LICENSE) | 53.8M / 74.8M full | 1.5 ms image encoding. [Paper](https://arxiv.org/pdf/2508.20691) |
| LAION aesthetic predictor v2 | Average predicted aesthetic appeal, on CLIP ViT-L/14 embeddings. [Code](https://github.com/christophschuhmann/improved-aesthetic-predictor/blob/main/simple_inference.py) | Apache-2.0. [Licence](https://github.com/christophschuhmann/improved-aesthetic-predictor/blob/main/LICENSE) | ~0.93M-parameter head (3.54 MB), plus the encoder | UNSOURCED |
| Q-Align / OneAlign | Quality and aesthetics through text-defined rating levels. [Repo](https://github.com/Q-Future/Q-Align) | Repo is non-commercial, the HF card says MIT: **unresolved**. [Terms](https://github.com/Q-Future/Q-Align/blob/main/LICENSE), [card](https://huggingface.co/q-future/one-align) | ~8.2B; 16.4 GB | UNSOURCED |
| NIMA (MobileNet, AVA) | Distribution of 1–10 human ratings. [Google](https://www.research.google/blog/introducing-nima-neural-image-assessment/) | Community implementation MIT. [Licence](https://github.com/titu1994/neural-image-assessment/blob/master/LICENSE) | ~3.2M; 12.6 MB | Community 6 MB Core ML export (macOS). [Export](https://github.com/Bibyutatsu/macos-computer-vision-models) |
| MUSIQ (AVA) | Full-image aesthetic score 1–10. [Card](https://www.kaggle.com/models/google/musiq) | Apache-2.0 | ~27M. [Paper](https://openaccess.thecvf.com/content/ICCV2021/papers/Ke_MUSIQ_Multi-Scale_Image_Quality_Transformer_ICCV_2021_paper.pdf) | UNSOURCED |

The Apple latency figures use Core ML Tools 7.0, batch 1, iPhone 12 Pro Max and iOS 17.0.3
([protocol](https://arxiv.org/pdf/2311.17049)). Treat each one as one model's speed, not as the
speed of a whole photo pipeline.

## Personal aesthetics and style

| Resource / method | Licence | Scale | What it measures |
|---|---|---|---|
| PARA dataset. [Paper](https://arxiv.org/html/2203.16754v1) | Dataset licence UNSOURCED | 31,220 photos; 438 raters; ~25 raters per image | Individual aesthetics, quality, attributes, content preference, willingness to share |
| PARA PIAA models | UNSOURCED | 10 or 100 rated examples per user | Fine-tune generic aesthetics for one user. PIAA predicts one person's rating; GIAA predicts the crowd's ([definition](https://arxiv.org/html/2504.07670v1)) |
| PIAA-MIR / PIAA-ICI. [Repo](https://github.com/lwchen6309/aesthetics_transfer_learning) | Reimplementation MIT | ViT-S, Swin-T | Image × user-attribute interactions. PARA SROCC 0.716 / 0.739 |
| LAPIS dataset. [Card](https://huggingface.co/datasets/asmaerten/LAPIS) | CC BY-NC 4.0 (non-commercial) | 11,723 artworks; 552 participants | Individual artistic appeal 0–100. MIR/ICI SROCC 0.6958/0.6941 → 0.2793/0.2773 on unseen users. [Paper](https://arxiv.org/html/2504.07670v1) |
| PAM. [Paper](https://openaccess.thecvf.com/content_iccv_2017/html/Ren_Personalized_Image_Aesthetics_ICCV_2017_paper.html) | UNSOURCED | 40,000 Flickr photos; 14 personal albums | A user-specific offset from generic aesthetics |
| Gram-matrix style. [Paper](https://arxiv.org/html/1508.06576v2) | One implementation MIT. [Licence](https://github.com/jcjohnson/neural-style/blob/master/LICENSE) | C×C per layer | Colour, texture and local structure. A style description, not a preference score |
| CSD style descriptors. [Code](https://github.com/learn2phoenix/CSD), [weights](https://huggingface.co/tomg-group-umd/CSD-ViT-L) | Code MIT; weights CC BY 4.0 | 511,921 training images; ViT-L checkpoint 2.44 GB | Style similarity. The authors flag gaps between the released weights and the paper's results |
| Style Aligned. [Repo](https://github.com/google/style-aligned) | Apache-2.0 | Training-free | Generates images that share a reference style. A generation method, not a taste reader |

## What follows for any product built on this

- Keep three things apart: style (what it looks like), technical quality (how well it was shot)
  and liking (what the person prefers). Each needs its own evidence.
- Check the exact weights, the licence, the conversion and the target device together. A
  permissive code licence does not cover research-only weights.
- Grade any taste claim against choices the person made themselves, held out from the data the
  model learned from.
