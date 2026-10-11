# C2: Small open vision-language models and grounded description

*Background research, sources checked 2026-10-11. Public models, benchmarks and methods only. It
does not say which models, if any, this project uses. **UNSOURCED** means no supporting public
evidence was found. **NF** means no verified number was found.*

A vision-language model (VLM) reads an image and writes text about it. The risk is
**hallucination**: describing things that are not in the photo.

## Findings

- **Licences vary a lot among small VLMs.** SmolVLM / SmolVLM2, Moondream 2, Florence-2 and Gemma
  4 E2B are under permissive licences (Apache-2.0 or MIT). Apple FastVLM is research-only. Moondream
  3 is under BSL 1.1 with restrictions. Gemma 3 has custom terms. LFM2.5-VL's commercial use is
  limited by revenue.
- **The benchmarks are not a leaderboard.** Each number comes from a different study with its own
  setup. None of them shows that a VLM can infer someone's occupation, personality or "brand" from
  a set of photos. They screen for errors about which objects are present, nothing more.
- **The pipeline matters more than the model (UNSOURCED design pattern, no effect size for this
  task):** send one photo per request; ask for short, visible-only observations tagged with the
  photo ID; aggregate in code into a ledger (claim → supporting photo IDs → events → count); keep a
  theme only if it recurs across separate events; check each kept theme against the original
  photos; write prose only from the approved ledger.
- **Measured fixes exist, but they depend on the model:**
  - A Woodpecker-style verification pass raised POPE accuracy by 30.66 points on a weak model
    (MiniGPT-4) but only about 1.7 points on LLaVA.
  - Decoding tricks (VCD, OPERA) gain a few points, but they need changes to the decoding step (how the model
    picks each next word). One study found that VCD *increased* caption hallucination.
  - Grounding fine-tunes such as UE-DPO cut CHAIRs from 43.2 to 16.7 on a 3B open VLM, but that
    means training a model.
- **UNSOURCED:** "tell the model not to hallucinate" and low temperature have no measured effect
  for this kind of task.

## What the hallucination benchmarks measure

| Benchmark | Measures |
|---|---|
| POPE. [Paper](https://arxiv.org/abs/2305.10355) | Yes/no "is there an X?" accuracy; higher is better |
| CHAIR. [Paper](https://aclanthology.org/D18-1437.pdf) | CHAIRᵢ: the share of object mentions that are hallucinated. CHAIRₛ: the share of captions with at least one. Lower is better |
| AMBER. [Repo](https://github.com/junyangwang0410/AMBER) | Errors about existence, attributes and relations, in both generated descriptions and yes/no answers |
| HallusionBench. [Repo](https://github.com/tianyi-lab/HallusionBench) | Question answering on visual illusions; not a caption hallucination rate |
| MMHal-Bench. [Desc](https://arxiv.org/html/2605.04874) | Open questions graded by an LLM judge |

## Models and published numbers

| Model | Licence, size | Multi-image | Published grounding numbers |
|---|---|---|---|
| SmolVLM2 2.2B / 500M / 256M. [Release](https://huggingface.co/blog/smolvlm2) | Apache-2.0 | Yes; iPhone demo through MLX | 2.2B greedy: CHAIRᵢ 6.06%, CHAIRₛ 20.08%, AMBER HalRate 25.7%. [MRGD](https://arxiv.org/html/2508.11616). 500M POPE 82.7. [AndesVL](https://arxiv.org/html/2510.11496) |
| SmolVLM (original ~2.2B). [Card](https://huggingface.co/HuggingFaceTB/SmolVLM-Instruct) | Apache-2.0 | Interleaved images | POPE 87.5 (500M 85.8, 256M 57.9). [VL-JEPA](https://arxiv.org/html/2512.10942) |
| Florence-2 0.23B / 0.77B. [Card](https://huggingface.co/microsoft/Florence-2-large) | MIT | One image per task | NF. Useful as a caption, detection and OCR extractor |
| Moondream 2. [Card](https://huggingface.co/vikhyatk/moondream2) | Apache-2.0, ~2B | One image | POPE 89.6 / 88.8 / 87.2 (random / popular / adversarial). [Pinned card](https://huggingface.co/vikhyatk/moondream2/blob/05d640e6da70c37b2473e0db8fef0233c0709ce4/README.md) |
| Moondream 3 Preview. [Card](https://huggingface.co/moondream/moondream3-preview) | BSL 1.1 + grant; 9B total, 2B active | Single image documented | POPE 89.0 (split unnamed) |
| Apple FastVLM. [Licence](https://huggingface.co/apple/FastVLM-0.5B/blob/main/LICENSE) | **Research-only** | Single image | POPE 87.0 / 87.6 (0.5B / 1.5B). [Report](https://arxiv.org/html/2412.13303v1) |
| Gemma 3 4B. [Card](https://ai.google.dev/gemma/docs/core/model_card_3) | Custom Gemma terms | Yes | POPE 84.6; HallusionBench 40.8. [AndesVL](https://arxiv.org/html/2510.11496) |
| Gemma 4 E2B. [Card](https://huggingface.co/google/gemma-4-E2B-it) | Apache-2.0; 2.3B effective | Interleaved; built for mobile | NF |
| North Micro Vision. [Card](https://huggingface.co/CohereLabs/North-Micro-Vision-Instruct) | Apache-2.0; 2.4B | Yes; 8K context | NF |
| LFM2.5-VL 1.6B. [Licence](https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B/blob/main/LICENSE) | LFM Open Licence (revenue limit) | Yes; GGUF / ONNX / WebGPU | NF |

## Grounding techniques and measured effects

| Technique | What it is | Evidence |
|---|---|---|
| Per-photo extraction, then aggregate | Atomic observations per photo, merged in code | UNSOURCED: no effect size for this task |
| Photo-ID citations | Every claim carries its supporting photo IDs; check that the IDs exist and actually show the claim | UNSOURCED: an audit mechanism, not a measured reduction |
| Frequency thresholds | Count supporting photos and separate events | UNSOURCED: any threshold must be checked against a null, e.g. shuffled photo sets |
| Verification pass (Woodpecker). [Paper](https://arxiv.org/html/2310.16045) | Split the draft into claims, ask visual questions, delete what is unsupported | MiniGPT-4 POPE 54.67 → 85.33; LLaVA 86.00 → 87.67 |
| VCD. [Paper](https://arxiv.org/html/2311.16922) | Contrast predictions on the real image against a noised copy | LLaVA-1.5 adversarial POPE F1 77.57 → 81.33. Needs changes to the decoding algorithm |
| OPERA. [Paper](https://arxiv.org/html/2311.17911) | Penalises over-trust in attention, with rollback in beam search | CHAIRₛ 18.8 → 14.2; CHAIRᵢ 5.9 → 5.2 |
| MRGD. [Paper](https://arxiv.org/html/2508.11616) | Reward models score candidate continuations | SmolVLM2: CHAIRᵢ 6.06 → 4.32; recall 70.17 → 68.04; 30 candidates per step |
| Grounding fine-tune (UE-DPO). [Paper](https://arxiv.org/html/2605.04874) | Preference training against unsupported content | 3B open VLM: CHAIRₛ 43.2 → 16.7; MMHal rate 49 → 41% |

## What follows

- Turn photos into an evidence ledger before turning the evidence into prose.
- Watch for one failure in particular: the same wrong caption, repeated across similar photos,
  looks like agreement. Count separate events, not photos.
- Keep claims to what is visible. Biographical facts must come from the person.
