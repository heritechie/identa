# Face Engine Evaluation

Status: research only. No implementation yet (AGENTS.md §18 step 2).
Authoritative sources cited inline.

## Goal

Pick one MVP face engine stack for Identa that is:

- commercially clean (OSS Identa may not depend on non-commercial model weights)
- realistically runnable in mobile browsers (Android Chrome, iOS Safari, WebViews)
- aligned with the core-first principle: framework-independent, swappable later
- privacy-first (client-side only, no required server)

## Hard license constraints

These ruled out otherwise strong candidates:

1. **InsightFace pretrained weights** (buffalo_l, buffalo_s, buffalo_m, buffalo_sc,
   antelopev2, SCRFD weights, ArcFace r100 / r50 weights) are
   **non-commercial research only**. Code is MIT; weights are not.
   - Source: <https://github.com/deepinsight/insightface> README,
     <https://github.com/deepinsight/insightface/issues/2022>,
     <https://pypi.org/project/insightface/0.3.6/>.
   - Commercial licensing exists but is enterprise sales-driven and not
     compatible with Identa's open, self-hostable posture.

2. **MS-Celeb-1M / MS1MV2 / MS1MV3 trained weights** inherit the dataset's
   non-commercial restriction regardless of the license on the model's own
   repo. This blocks most pre-trained face-recognition checkpoints including
   MobileFaceNet, FaceX MobileFaceNet, and most community ArcFace exports.

3. **WIDER FACE** (the standard face-detection training set) is distributed
   "for non-commercial research and educational purposes". Models trained on
   it inherit a license gray area. Mitigation: use a detector with a clear
   permissive-data lineage (Google MediaPipe) or treat detection models as
   well-known-practice redistribution.

## Runtime constraints

**ONNX Runtime Web** (MIT) is the AGENTS.md §5 preferred runtime.

| Browser          | WASM | WebGPU | WebGL |
|------------------|:----:|:------:|:-----:|
| Chrome / Edge (desktop) | ✅ | ✅ | ✅ (maintenance) |
| Chrome / Edge (Android) | ✅ | ✅ | ✅ |
| Safari (macOS)   | ✅ | TP only | ✅ |
| Safari (iOS)     | ✅ | **❌**  | ✅ |
| Firefox          | ✅ | flag only | ✅ |

WebGPU is **not** available on iOS Safari as of 2026. Any mobile stack must
fall back to WASM. Sources: <https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html>,
<https://github.com/microsoft/onnxruntime/issues/22776>.

## Candidates considered

| # | Candidate                                  | Detector              | Embedding                        | Runtime            |
|---|--------------------------------------------|----------------------|----------------------------------|--------------------|
| 1 | InsightFace buffalo_sc                     | SCRFD-500MF          | MobileFaceNet (w/ ArcFace loss)  | ONNX Runtime Web   |
| 2 | InsightFace buffalo_l                      | SCRFD-10GF           | ArcFace-r100 (MS1MV2)            | ONNX Runtime Web   |
| 3 | MediaPipe Tasks + MobileFaceNet (community)| BlazeFace short-range| MobileFaceNet (MS-Celeb-1M)      | MP Tasks + ORT Web |
| 4 | MediaPipe Tasks + dlib face_recognition    | BlazeFace short-range| dlib face_recognition_resnet_v1  | MP Tasks + ORT Web*|
| 5 | face-api.js (TF.js)                        | TinyFaceDetector     | face_recognition_model (dlib)    | TensorFlow.js      |
| 6 | face-api.js + MediaPipe hybrid             | BlazeFace            | face_recognition_model (dlib)    | MP Tasks + TF.js   |

*Option 4 requires converting dlib weights to ONNX ourselves.

## Detailed license audit

| Candidate | Code license | Detection model license | Embedding model license | Verdict |
|-----------|--------------|-------------------------|-------------------------|---------|
| 1 (InsightFace buffalo_sc) | MIT | Apache-2.0 (SCRFD code) but **weights: non-commercial research only** | **non-commercial research only** | ❌ BLOCKED |
| 2 (InsightFace buffalo_l)  | MIT | Apache-2.0 (SCRFD code) but **weights: non-commercial research only** | **non-commercial research only** | ❌ BLOCKED |
| 3 (MP + MobileFaceNet)     | Apache-2.0 | Apache-2.0 (Google MediaPipe) ✅ | trained on MS-Celeb-1M → **non-commercial** ❌ | ❌ BLOCKED |
| 4 (MP + dlib ONNX)         | Apache-2.0 | Apache-2.0 (Google MediaPipe) ✅ | **BSL-1.0** (dlib) ✅ | ✅ commercially clean |
| 5 (face-api.js)            | MIT ✅ | trained on WIDER FACE — gray area ⚠️ | dlib weights (BSL-1.0) ✅ | ⚠️ acceptable with caveat |
| 6 (MP + face-api.js)       | MIT + Apache-2.0 | Apache-2.0 ✅ | dlib weights (BSL-1.0) ✅ | ✅ commercially clean |

Sources:

- MediaPipe Apache-2.0: <https://github.com/google/mediapipe/blob/master/mediapipe/tasks/python/vision/face_landmarker.py>,
  <https://huggingface.co/Heliosoph/mediapipe-face-onnx>.
- dlib BSL-1.0: <https://github.com/davisking/dlib>; weights redistributed by
  face-api.js with explicit provenance to davisking/dlib.
- face-api.js MIT: <https://github.com/justadudewhohacks/face-api.js/blob/master/LICENSE>.
- face-api.js detection weights trained on WIDER FACE — not explicitly cleared;
  WIDER FACE is widely accepted as research-only.
- InsightFace non-commercial: confirmed in upstream README, PyPI, and multiple
  mirror READMEs (e.g., `mnmly/mlx-swift-SCRFD` README explicitly disclaims
  the SCRFD weights from MIT coverage).

## Comparison

| candidate | detector | embedding | runtime | model size | browser support | mobile suitability | license | major risks | recommendation |
|-----------|----------|-----------|---------|------------|-----------------|--------------------|---------|-------------|----------------|
| 1 | SCRFD-500MF | MobileFaceNet | ORT Web | ~35 MB | WASM ✅ / WebGPU partial | acceptable | ❌ non-commercial | commercial blocker | NO |
| 2 | SCRFD-10GF  | ArcFace-r100 | ORT Web | ~250 MB | WASM ✅ / WebGPU partial | heavy | ❌ non-commercial | size + license | NO |
| 3 | BlazeFace   | MobileFaceNet | MP Tasks + ORT Web | ~10 MB | WASM ✅ / WebGPU ✅ (Android Chrome) | good | ❌ MS-Celeb-1M weights | commercial blocker | NO |
| 4 | BlazeFace   | dlib face_recognition_resnet (ONNX) | MP Tasks + ORT Web | ~8 MB | WASM ✅ / WebGPU ✅ | excellent | ✅ Apache-2.0 + BSL-1.0 | requires ONNX conversion engineering | YES (v0.2) |
| 5 | TinyFaceDetector | face_recognition_model (dlib) | TF.js | ~7 MB | WASM ✅ / WebGL ✅ / WebGPU experimental | excellent | ⚠️ MIT + BSL-1.0 + WIDER FACE gray area | face-api.js stagnant; detector dataset gray area | **YES (MVP)** |
| 6 | BlazeFace   | face_recognition_model (dlib) | MP Tasks + TF.js | ~28 MB | WASM ✅ / WebGPU ✅ | mixed | ✅ | mixed runtime, heavier bundle | MAYBE |

## Recommendation

**MVP engine stack: candidate #5 — face-api.js via TensorFlow.js.**

- Detector: `TinyFaceDetector` (190 KB, ~14k image training set,
  explicitly authored for mobile and resource-limited clients).
- Embedding: `face_recognition_model` (6.2 MB, 128-D descriptor,
  ResNet-34-like, weights authored by davisking / dlib, BSL-1.0,
  99.38% LFW).
- Runtime: `@tensorflow/tfjs-backend-wasm` (and `tfjs-converter`
  for the model format). WASM is supported everywhere; WebGL is a
  fallback for hardware-accelerated mobile inference.

### Why this is the best fit for the MVP

1. **Lowest engineering cost** — no model conversion, no ONNX pipeline.
   We can ship a working verification primitive and validate the POC
   immediately. This matches AGENTS.md §20's priority:
   *working verification primitive > architecture complexity > feature count*.
2. **Commercially clean** for the embedding model (dlib BSL-1.0,
   redistribution explicitly allowed by face-api.js's provenance) and
   the library code (MIT). The WIDER FACE dataset question on the
   detection weights is a known industry-accepted gray area — we accept
   it for the MVP with a documented migration path.
3. **Mobile-suitable by design** — TinyFaceDetector is 190 KB and is
   described in the upstream README as the "GO-TO face detector on
   mobile devices and resource limited clients". The face_recognition
   model adds 6.2 MB. Total ~7 MB plus a ~1 MB TF.js runtime.
4. **WASM works everywhere** including iOS Safari, where WebGPU is
   still unavailable (2026).
5. **Core decoupling preserved** — the engine is injected into
   `@identa/core` via the `FaceEngine` interface already defined in
   `packages/core/src/types.ts`. Swapping engines later is a drop-in.
6. **Pure browser execution** — no required server, satisfies
   privacy-first / self-hostable principles.

### Risks and explicit mitigations

| Risk                                                                 | Mitigation |
|----------------------------------------------------------------------|------------|
| face-api.js last release 2020-03-22, last push 2024-01-24 — stagnant | We depend only on the inference API; the model weights are stable. v0.2 migration to ORT Web removes the dependency. |
| TinyFaceDetector / SSDMobileNetv1 trained on WIDER FACE — license gray area | Accepted for MVP. Documented. Replace with MediaPipe BlazeFace in v0.2 (Apache-2.0 lineage). |
| TF.js bundle size ~1 MB compressed                                    | Acceptable. Smaller than ORT Web WASM bundle in many configs. |
| WebGPU support in TF.js is still experimental                         | WASM + WebGL are sufficient for mobile MVP. |
| 99.38% LFW accuracy is below state-of-the-art                          | Acceptable for POC. Threshold selection will be evaluation-driven. |

### v0.2 migration path (post-MVP)

Once the POC validates the workflow:

- Detector: MediaPipe Face Detector (BlazeFace short-range, Apache-2.0)
  via `@mediapipe/tasks-vision`. ~600 KB.
- Embedding: convert dlib `face_recognition_resnet_model_v1` from
  TF.js format to ONNX ourselves, then run via ONNX Runtime Web.
- Result: single runtime (ORT Web), full WebGPU where supported,
  smaller payload, all-Apache-2.0 chain except dlib's BSL-1.0 weights
  which are commercially permissive.

### Engine evaluation against the 15 criteria

| # | Criterion                                | face-api.js + TF.js |
|---|-------------------------------------------|---------------------|
| 1 | Face detection                            | ✅ TinyFaceDetector |
| 2 | Face embedding / recognition               | ✅ dlib weights |
| 3 | Browser execution                          | ✅ WASM / WebGL |
| 4 | ONNX Runtime Web compatibility             | ❌ TF.js, not ORT   |
| 5 | WASM compatibility                         | ✅ tfjs-backend-wasm |
| 6 | WebGPU compatibility                       | ⚠️ experimental in TF.js |
| 7 | Mobile browser performance                 | ✅ TinyFaceDetector designed for mobile |
| 8 | Model size                                 | ✅ ~7 MB total |
| 9 | CPU requirements                           | ✅ low |
| 10 | Accuracy / recognition quality            | ⚠️ 99.38% LFW, below ArcFace |
| 11 | License                                   | ✅ MIT + BSL-1.0 (detection: gray) |
| 12 | Commercial usage                          | ✅ yes |
| 13 | Redistribution of model weights            | ✅ yes (per face-api.js redistribution) |
| 14 | Maintenance / project activity            | ⚠️ stagnant (acceptable for MVP, v0.2 swaps it out) |
| 15 | Ability to run fully client-side           | ✅ yes |

## Stop condition

Per the user's brief: this evaluation is research only. No engine code
will be written, and no new dependencies will be installed, until this
recommendation is approved.

---

## Benchmark methodology (added 2026-Q4)

Model selection was deferred until empirical evaluation is possible. The
benchmark harness is implemented in `tools/benchmark/` (`@identa/benchmark`).
It is vendor-neutral, framework-independent, and does not depend on any
specific face model, runtime, or vendor library.

### Why model selection is deferred

- **Public benchmark numbers are not a substitute for on-dataset evaluation.**
  LFW / CFP-FP / AgeDB-30 numbers published in papers do not capture
  Identa's real input distribution: small KTP face crops, casual selfies,
  varied illumination, and demographic skew from the Identa use case.
- **Pretrained weights inherit their training-data license.** Until we
  know which weights are commercially clean AND how those weights behave
  on Identa's actual data, picking a model from a leaderboard is premature.
- **Threshold selection must be empirical.** `DEFAULT_THRESHOLD = 0.5` in
  `@identa/core` is a placeholder for the POC. The production threshold
  is set from the FAR/FRR trade-off the benchmark measures on Identa's
  private dataset.

### Benchmark scope

The benchmark evaluates the **embedding model only**. Detection,
alignment, and image decoding are deliberately out of scope: they are
the engine adapter's responsibility and can be changed without
invalidating the benchmark results, as long as the cropped/aligned face
input to the embedder is stable.

### Dataset requirements

- Stored on local disk; **never committed**.
- Path resolved via the `IDENTA_DATASET_PATH` environment variable.
- Layout (per person):

  ```text
  dataset/
    person-001/
      ktp.jpg
      selfie.jpg
      video.mp4          # optional, for video-frame pairs
    person-002/
      ...
  ```

- No real biometric data, no NIK, no names, no addresses.
- Each person MUST appear in exactly one split (train, dev, or test).
  The split logic enforces person-disjoint assignment by construction.
- Image decoding is the engine adapter's concern. The benchmark only
  consumes pre-decoded `ImageInput` (raw RGBA pixels).

### Pair generation

Deterministic, sorted by person ID.

- Positive: `KTP(person A) ↔ selfie(person A)` — one per person.
- Negative: `KTP(person A) ↔ selfie(person B)` for all `A ≠ B`.
  Symmetric by default (`N × (N-1)` pairs); can be disabled for
  `N × (N-1) / 2` unordered pairs.
- Video: `KTP(person A) ↔ frame(video of person A)` — placeholder,
  no frame extraction implementation yet.

### Metrics

- **FAR** = false accepts / total negatives (lower is better for security)
- **FRR** = false rejects / total positives (lower is better for UX)
- **TAR** = 1 − FRR (true accept rate)
- **TRR** = 1 − FAR (true reject rate)
- **Inference latency**: mean, p50, p95, p99, min, max (milliseconds,
  measured around `engine.embed()`).

Threshold sweep is generated across `[0.20, 0.25, ..., 0.90]` by default,
covering the operational range of cosine similarity for face embeddings.
This lets the threshold table drive future production tuning rather than
relying on an arbitrary default.

### Threshold calibration approach

1. Run the benchmark with a candidate engine on Identa's private dataset.
2. Inspect the FAR vs FRR trade-off curve from the threshold sweep.
3. Pick the threshold at the chosen operating point (e.g., FAR ≤ 0.001
   with minimum FRR, or FRR ≤ 0.05 with minimum FAR).
4. Document the chosen operating point, dataset version, and engine
   version. Do not change `DEFAULT_THRESHOLD` in `@identa/core` without
   re-running the benchmark.

### Privacy requirements

The benchmark MUST NOT log, commit, upload, or persist:

- KTP / selfie / video files
- Face embeddings
- NIK, names, addresses, or any other identity data

The runner enforces this by construction:

- The output object contains only aggregate counts and metrics.
- `serializeBenchmark` re-shapes the output into a closed JSON schema;
  any field added to `BenchmarkOutput` that isn't in that schema is
  dropped, so a future field cannot accidentally leak PII.
- Person IDs and file paths are stored inside `Pair` objects during
  pair generation but never propagate past the runner's internal loop.
- The default `datasetLabel` is `"private"` to discourage committing a
  real dataset path to a result file.

### Public results vs Identa's own evaluation

Public benchmarks (LFW, etc.) are useful only as a coarse first-pass
filter. Identa's own evaluation on its private dataset is what drives
the production threshold, the engine choice, and any future model swap.
Public numbers and Identa's numbers are not interchangeable and must
not be conflated in documentation.

---

# Embedding Model Evaluation

Status: research only. No implementation yet.
Added: after the end-to-end "face-api.js via TF.js" candidate was
cancelled. This evaluation covers **embedding models only**, separated
deliberately from the detector candidate (which is evaluated separately
in a future iteration).

## Scope

This evaluation answers one question:

> Which face **embedding** model could power Identa's `engine.embed()`,
> given that the engine interface and the benchmark harness are already
> defined?

Out of scope here:

- Face detection (separate evaluation, not yet started).
- Image / video decoders (engine adapter concern).
- Face alignment algorithms (engine adapter concern).
- Liveness, anti-spoofing, OCR, document verification — explicitly
  deferred per AGENTS.md §3 and §18.

The previous end-to-end "face-api.js via TF.js" stack (candidate #5 in
the "Recommendation" section above) is now **parked** for the reasons
documented in this section: the underlying dlib embedding weights are
CC0 but were trained on a mix including VGG Face (CC-BY-NC), which
needs explicit license clarification before commercial use. The
TinyFaceDetector component is also a separate evaluation thread (WIDER
FACE training-data concerns).

## Methodology

For each candidate we record, with primary-source URLs:

1. Model architecture and parameter count.
2. Embedding dimension.
3. Public benchmark numbers (LFW verification accuracy, EER, etc.) —
   recorded for context only, never as a substitute for Identa's own
   evaluation.
4. Training dataset and dataset license.
5. Pretrained weight provenance.
6. Code license, weight license, commercial-use status, redistribution
   status.
7. Runtime / format compatibility (ONNX Runtime Web, WASM, WebGPU, TF.js,
   MediaPipe Tasks).
8. Browser support matrix.
9. Mobile / WebView feasibility.

Candidates are sorted into three categories, not ranked:

- **A — Potentially usable**: code, weights, and training data are all
  on a commercially-clear path with primary-source documentation.
- **B — Requires license / provenance clarification**: at least one
  link in the chain (code, weights, or training data) is ambiguous or
  conflicting between primary sources.
- **C — Reject for Identa**: at least one blocker is confirmed by a
  primary source and is not resolvable inside Identa's open-source,
  self-hostable posture.

A candidate in category C may still be technically excellent; the
category reflects Identa's specific posture, not the model's quality.

## Candidates investigated

| # | Candidate                            | Architecture                  | Embedding dim | Public LFW | Training data       | Code license | Weight license           | Category |
|---|--------------------------------------|-------------------------------|---------------|------------|---------------------|--------------|--------------------------|----------|
| 1 | dlib `face_recognition_resnet_v1`    | ResNet-34 (modified)          | 128           | 99.38%     | FaceScrub + VGG-Face + scraped | BSL (dlib code) | CC0 (weights file) | B |
| 2 | InsightFace `buffalo_sc`             | MobileFaceNet                 | 512           | (≈ buffalo_s) | WebFace600K (refined MS-Celeb-1M) | MIT | non-commercial research | C |
| 3 | InsightFace `buffalo_l`              | ResNet-50 @ WebFace600K       | 512           | 99.83%     | WebFace600K          | MIT          | non-commercial research  | C |
| 4 | davidsandberg FaceNet (VGGFace2 ckpt)| Inception-ResNet-v1           | 512           | 99.65%     | VGGFace2             | MIT          | (inherits VGGFace2 terms)| C |
| 5 | Identa-trained on commercial-clean data | TBD (ArcFace-style head on a permissive backbone) | TBD | TBD | TBD (must be CC0/MIT/Apache or first-party-consented) | TBD | TBD (own) | B (feasibility) |

## Detailed analysis

### 1. dlib `dlib_face_recognition_resnet_model_v1.dat` — Category B

- **Original repository**: <https://github.com/davisking/dlib-models>
  (the weights file lives next to the dlib code; redistribution by
  Adam Geitgey's `face_recognition_models` package is also CC0).
- **Architecture**: 29-layer ResNet (a modified ResNet-34 with fewer
  filters). Documented in the upstream model README.
- **Embedding dimension**: 128.
- **Public LFW accuracy**: 99.38% (per dlib README and Adam Geitgey's
  `face_recognition` docs).
- **Training data** (per upstream README at
  <https://github.com/davisking/dlib-models>):
  > "The network was trained from scratch on a dataset of about 3
  > million faces. This dataset is derived from a number of datasets.
  > The face scrub dataset, the VGG dataset
  > (<http://www.robots.ox.ac.uk/~vgg/data/vgg_face/>), and then a
  > large number of images I scraped from the internet."
- **VGG Face license** (the dataset used to train this model):
  "Creative Commons Attribution-NonCommercial 4.0 International" per
  <https://www.robots.ox.ac.uk/~vgg/data/vgg_face/licence.txt> and
  the VGG data-access terms at
  <https://robots.ox.ac.uk/~vgg/terms/dataset-group-2-access.html>
  ("strictly for non-commercial research").
- **Pretrained weight license**: CC0 1.0 Universal. The dlib-models
  LICENSE file at
  <https://github.com/davisking/dlib-models/blob/master/LICENSE>
  contains a CC0 grant on the model files. Confirmed by Adam
  Geitgey's mirror: <https://github.com/ageitgey/face_recognition_models/blob/master/README.rst>
  ("These models were created by Davis King and are licensed in the
  public domain or under CC0 1.0 Universal.").
- **Code license** (dlib): BSL-1.0 per
  <https://github.com/davisking/dlib/blob/master/LICENSE.txt>.
  Identa would only consume the weights, not the dlib code, so this
  is mostly a non-issue if Identa re-implements inference in
  TypeScript / ONNX.
- **Commercial use**: the weights themselves are CC0, which permits
  commercial use. The blocker is whether the CC0 grant on the weights
  overrides the CC-BY-NC restriction on a portion of the training
  data. Primary sources do not resolve this conflict; legal
  interpretation varies by jurisdiction.
- **Runtime compatibility**:
  - **ONNX Runtime Web**: ❌ out of the box. The weights are a dlib
    binary blob, not ONNX. Conversion would require a custom
    extraction + export script (dlib's NN format is documented but
    not ONNX). Significant engineering effort.
  - **TF.js**: ✅ — face-api.js / `@vladmandic/face-api` ship these
    weights in TF.js graph-model format.
  - **WASM / WebGPU**: depends on chosen runtime (TF.js WASM ✅;
    WebGL ✅; TF.js WebGPU ⚠ experimental).
  - **Mobile feasibility**: small embedding model but heavyweight
    preprocessing / alignment via TF.js pipeline.
- **Identa suitability**: technically mature, smallest viable
  embedding model. License is the only open question. If Identa
  treats "weights are CC0" as sufficient (a defensible but not
  universally-held reading), this is the most realistic browser-first
  candidate without a training effort.

### 2. InsightFace `buffalo_sc` — Category C

- **Original repository**: <https://github.com/deepinsight/insightface>
- **Architecture**: MobileFaceNet.
- **Embedding dimension**: 512.
- **Training data**: WebFace600K (a Tsinghua-curated subset of
  WebFace260M). Per py-feat's model card at
  <https://huggingface.co/py-feat/arcface_r50>: "Training data:
  WebFace600K — Tsinghua-curated subset of WebFace260M (Zhu et al.,
  2021)."
- **WebFace260M / WebFace600K license**: non-commercial research only,
  per the WebFace260M dataset license agreement referenced at
  <https://www.face-benchmark.org/>.
- **Pretrained weight license**: "ALL models are available for
  non-commercial research purposes only." Source:
  <https://github.com/deepinsight/insightface/blob/master/model_zoo/README.md>
  and <https://github.com/deepinsight/insightface/issues/2022>.
- **Commercial use**: explicit blocker. Enterprise commercial licensing
  exists via <https://www.insightface.ai/solutions/face-recognition-licensing>
  but is sales-driven and incompatible with Identa's OSS,
  self-hostable posture.
- **Runtime compatibility**:
  - **ONNX Runtime Web**: ✅ — `buffalo_sc` ships in ONNX format
    (MobileFaceNet + SCRFD-500MF).
  - **WASM / WebGPU**: ✅ (WASM universal; WebGPU partial iOS gap).
  - **Mobile feasibility**: `buffalo_sc` is the smallest pack (~16 MB
    including detector) and explicitly the "mobile" tier.
- **Identa suitability**: highest accuracy / size ratio of the
  InsightFace family. Blocked by weight license, not by quality.

### 3. InsightFace `buffalo_l` — Category C

- **Original repository**: <https://github.com/deepinsight/insightface>
- **Architecture**: ResNet-50 with ArcFace head, trained on
  WebFace600K.
- **Embedding dimension**: 512.
- **Public LFW**: 99.83% per py-feat card (mirrors upstream
  InsightFace numbers).
- **Training data**: WebFace600K (same non-commercial-research
  restrictions as buffalo_sc).
- **Pretrained weight license**: non-commercial research only (same
  link as above).
- **Runtime compatibility**: ONNX Runtime Web ✅. Model size ~326 MB
  (entire pack); embedding model alone is the ResNet-50 portion.
- **Identa suitability**: state-of-the-art accuracy, but too heavy for
  Identa's mobile-first goal AND blocked by license. No reason to
  prefer it over buffalo_sc if license were cleared.

### 4. davidsandberg FaceNet (Inception-ResNet-v1, VGGFace2 ckpt) — Category C

- **Original repository**: <https://github.com/davidsandberg/facenet>
- **Architecture**: Inception-ResNet-v1 (Schroff et al., FaceNet
  paper).
- **Embedding dimension**: 512.
- **Public LFW**: 99.65% (model `20180402-114759`).
- **Training data**: VGGFace2 per the README table at
  <https://github.com/davidsandberg/facenet>.
- **VGGFace2 license**: CC-BY-NC 4.0 per
  <https://www.robots.ox.ac.uk/~vgg/data/vgg_face/licence.txt>:
  "The images are covered under a Creative Commons
  Attribution-NonCommercial 4.0 International license ... Downloading
  this dataset implies agreement to follow the same conditions of
  non-commercial research for any modification and/or
  re-distribution of the dataset in any form."
- **Pretrained weight license**: not explicitly stated, but the
  weights are a direct derivative of a model trained on a
  non-commercial-research-only dataset.
- **Runtime compatibility**:
  - **ONNX Runtime Web**: ⚠ — original is TensorFlow checkpoint
    format; community ONNX exports exist but provenance is uncertain.
  - **TF.js**: ✅ via community ports.
- **Identa suitability**: historically important, well-documented.
  Blocked by training data.

### 5. Identa-trained model on a commercial-clean dataset — Category B (feasibility)

This is not a candidate to evaluate but a path to enable candidates A
or B. It would require Identa to:

1. Acquire a training dataset whose license permits commercial use
   (CC0, Apache-2.0, MIT, first-party consent with documented rights,
   or a synthetic face dataset with permissive terms).
2. Train an ArcFace-style head on a mobile-friendly backbone
   (MobileFaceNet, MobileNetV3, EfficientNet-B0) using public ArcFace
   loss implementations (MIT-licensed training code).
3. Document the resulting model card with the same rigor this document
   applies to third-party candidates.

Realistic dataset options to evaluate:

- **Synthetic face datasets** (e.g., the NVidia/Stanford "Synthetic
  Faces" line, DCFace, SFace) — generated from a generative model,
  no real-person biometric data. Licensing depends on each project's
  terms; many are research-only and would need clarification.
- **First-party consented data** — Identa's own user-base consents.
  Doesn't exist yet for Identa.
- **Public commercial datasets** — rare. Most public face datasets
  (CASIA-WebFace, VGGFace2, MS-Celeb-1M, WebFace260M, etc.) are
  non-commercial-research.

This is a multi-month effort and not in scope for the POC. It is
documented here so future contributors don't assume "just train a
model" is a quick fix.

## Comparison table

| Candidate | Arch | Dim | Model size | Runtime | WASM | WebGPU | Mobile feasibility | Public LFW | Training dataset | Weight provenance | Code license | Weight license | Commercial use | Redistribution | Main risks | Identa suitability |
|-----------|------|-----|------------|---------|------|--------|---------------------|------------|------------------|--------------------|--------------|----------------|----------------|----------------|------------|---------------------|
| 1. dlib face_recognition_resnet_v1 | ResNet-34 (mod) | 128 | ~6.2 MB (TF.js format) | TF.js / needs port for ORT | ✅ via TF.js | ⚠ via TF.js experimental | ✅ (small) | 99.38% | VGG Face + FaceScrub + scraped | dlib-models repo, mirrored by ageitgey | BSL (dlib code); not consumed by Identa | CC0 | ambiguous: weights CC0, training data partially CC-BY-NC | ✅ (CC0 grant) | Training-data → weights inheritance is unresolved; not ONNX | A-pending-legal-review, else B |
| 2. InsightFace buffalo_sc (MBF @ WebFace600K) | MobileFaceNet | 512 | ~16 MB pack, ~3 MB embedding only | ORT Web ✅ (ONNX) | ✅ | ✅ (Android Chrome) | ✅ (mobile tier) | ≈ buffalo_s | WebFace600K | deepinsight/insightface model_zoo | MIT | non-commercial research | ❌ hard blocker | ❌ with weights | Weights explicitly non-commercial; even re-hosting is restricted | C |
| 3. InsightFace buffalo_l (R50 @ WebFace600K) | ResNet-50 | 512 | ~326 MB pack, ~170 MB embedding | ORT Web ✅ (ONNX) | ✅ | ✅ (Android Chrome) | ⚠ too heavy | 99.83% | WebFace600K | deepinsight/insightface model_zoo | MIT | non-commercial research | ❌ | ❌ | Same as #2, plus size | C |
| 4. davidsandberg FaceNet (VGGFace2 ckpt) | Inception-ResNet-v1 | 512 | ~90 MB (TF ckpt) | TF.js community ports ⚠ | via TF.js | via TF.js experimental | ⚠ heavy | 99.65% | VGGFace2 | davidsandberg/facenet README | MIT | inherits VGGFace2 NC | ❌ | ❌ | Training data CC-BY-NC; format not directly ORT | C |
| 5. Identa-trained model | TBD (ArcFace head on a mobile backbone) | TBD | TBD | ORT Web (ONNX export) | ✅ | ✅ | ✅ (designed for) | TBD | TBD | own | own | own | ✅ (only if training data is clean) | ✅ | Data acquisition + training effort | B (feasibility-only) |

## Categorization

### A — Potentially usable

**Empty.** No investigated candidate has a primary-source-documented
chain from training data through weights through code license that
unambiguously permits commercial use of a face-recognition embedding
model in an OSS self-hostable project.

This is a finding, not a recommendation against. It means Identa cannot
ship a pretrained face-embedding model today without either:

- Resolving the legal interpretation around dlib + VGG Face (candidate 1).
- Training Identa's own model on a commercially-clean dataset
  (candidate 5).
- Accepting a non-commercial-only restriction (incompatible with the
  project's posture).

### B — Requires clarification

- **Candidate 1 (dlib)** — requires legal review of whether the CC0
  weight file's grant overrides the CC-BY-NC restriction on the VGG
  Face portion of the training corpus. Defensible interpretations
  exist on both sides; no court precedent on this specific situation
  was found in primary sources.
- **Candidate 5 (Identa-trained)** — feasible in principle, blocked
  in practice by data acquisition.

### C — Reject for Identa

- **Candidate 2 (InsightFace buffalo_sc)** — weights are explicitly
  non-commercial-research-only. Primary source:
  <https://github.com/deepinsight/insightface/blob/master/model_zoo/README.md>.
- **Candidate 3 (InsightFace buffalo_l)** — same as #2, plus too
  heavy for mobile-first.
- **Candidate 4 (davidsandberg FaceNet, VGGFace2 ckpt)** — trained on
  VGGFace2 (CC-BY-NC 4.0 per
  <https://www.robots.ox.ac.uk/~vgg/data/vgg_face/licence.txt>).
  Other FaceNet checkpoints (`20170511-185253` CASIA-WebFace and
  `20170512-110547` MS-Celeb-1M) inherit their respective dataset
  restrictions and are blocked for the same reason.

### Adjacent candidates briefly considered but not added to the table

These were looked at and rejected without a full entry. Each is
documented here so the next researcher doesn't redo the search.

- **OpenFace (cmusatyalab/openface, Apache-2.0)** — too low accuracy
  for Identa's verification use case (~92% LFW vs ~99% for the
  modern candidates). Also trained on FaceScrub + CASIA-WebFace
  (CASIA-WebFace license is not unambiguously commercial-clean).
- **`@vladmandic/human` library (MIT)** — runtime is MIT, but the
  included `mobilefacenet` and `insightface` modules wrap weights
  whose license is non-commercial (per the Human wiki at
  <https://github.com/vladmandic/human/wiki/Models>). The runtime
  pattern is fine; the bundled weights are not.
- **HSE FaceRes** — face attribute / description, not face recognition
  embedding. Out of scope.
- **Hailo Model Zoo ArcFace MobileFaceNet (`arcface_mobilefacenet.yaml`)** —
  Hailo publishes under MIT but trained on `ms1mv3` (MS-Celeb-1M
  derivative, non-commercial). Per the Hailo config at
  <https://github.com/hailo-ai/hailo_model_zoo/blob/main/hailo_model_zoo/cfg/networks/arcface_mobilefacenet.yaml>.
- **AdaFace, MagFace, CurricularFace, ElasticFace** — research
  repositories with strong accuracy; pretrained weights are trained
  on MS-Celeb-1M variants in the published releases. Same blocker.
- **py-feat `arcface_r50` (Hugging Face)** — confirmed in the model
  card at <https://huggingface.co/py-feat/arcface_r50> that the
  InsightFace-derived weights inherit the upstream non-commercial
  restriction.
- **face-api.js `face_recognition_model`** — same file as dlib
  candidate 1, in TF.js format. Same blocker.

## Sources (primary)

- InsightFace license statement:
  <https://github.com/deepinsight/insightface/blob/master/model_zoo/README.md>,
  <https://github.com/deepinsight/insightface/blob/master/recognition/arcface_torch/README.md>,
  <https://pypi.org/project/insightface/0.6.2/>,
  <https://www.insightface.ai/solutions/face-recognition-licensing>.
- VGG Face dataset license:
  <https://www.robots.ox.ac.uk/~vgg/data/vgg_face/licence.txt>,
  <https://robots.ox.ac.uk/~vgg/terms/dataset-group-2-access.html>.
- WebFace260M / WebFace600K:
  <https://www.face-benchmark.org/>, py-feat model card at
  <https://huggingface.co/py-feat/arcface_r50>.
- dlib model license (CC0):
  <https://github.com/davisking/dlib-models/blob/master/LICENSE>,
  <https://github.com/davisking/dlib-models>,
  <https://github.com/ageitgey/face_recognition_models/blob/master/README.rst>.
- dlib code license (BSL):
  <https://github.com/davisking/dlib/blob/master/LICENSE.txt>.
- FaceNet (davidsandberg):
  <https://github.com/davidsandberg/facenet>,
  <https://github.com/davidsandberg/facenet/wiki/Training-using-the-VGGFace2-dataset>.
- MobileFaceNet (Chen et al., 2018):
  <https://arxiv.org/pdf/1804.07573>.
- Sirius-AI MobileFaceNet_TF (Apache-2.0 code, MS1M-refine-v2 weights):
  <https://github.com/sirius-ai/MobileFaceNet_TF/blob/master/LICENSE>.
- Human library model list and license inheritance statement:
  <https://github.com/vladmandic/human/wiki/Models>.
- Hailo model zoo config:
  <https://github.com/hailo-ai/hailo_model_zoo/blob/main/hailo_model_zoo/cfg/networks/arcface_mobilefacenet.yaml>.

## Unresolved questions

1. **dlib weights vs VGG Face training data** — does the CC0 grant on
   the weight file override the CC-BY-NC restriction on a portion of
   the training corpus? Defensible interpretations exist on both
   sides. Identa needs a documented legal opinion (or a different
   model) before commercial deployment of candidate 1.
2. **Synthetic / commercial face datasets** — are any of the
   synthetic face generation projects (DCFace, SFace, NVidia
   SyntheticFaces, etc.) redistributable under commercial terms? Not
   researched in this pass; flagged for the next iteration.
3. **First-party consented data** — Identa has none. Building it
   requires consent infrastructure, DPIA, and storage policy that is
   currently out of scope.
4. **ONNX export of dlib weights** — would require reverse-engineering
   dlib's NN binary format. No public tool exists. Feasibility not
   confirmed.
5. **TF.js → ORT Web migration path** — if candidate 1 is chosen and
   TF.js is the runtime, the v0.2 migration to ORT Web requires either
   converting dlib weights to ONNX (see #4) or retraining (candidate 5).

## Parked previous candidates

The following earlier candidates are preserved here for history. They
are **not active** for the reasons noted. Do not pick from this list
without re-reading the current section above.

- **face-api.js + TinyFaceDetector + face_recognition_model via TF.js**
  (earlier candidate #5 in this document). Parked: the underlying
  dlib embedding weights are the same as candidate 1 above (CC0
  weights, CC-BY-NC training-data concern); TinyFaceDetector is
  trained on WIDER FACE, which is a separate non-commercial-research
  restriction. The TF.js runtime choice blocked WASM support on the
  stagnant 0.22.2 release; migrating to the maintained
  `@vladmandic/face-api` fork was the path, but the user's choice to
  cancel the implementation removed the option.
- **InsightFace `buffalo_sc` end-to-end pipeline (detection + embedding).**
  Parked: same weight license blocker as candidate 2 above.
- **`@vladmandic/human` end-to-end pipeline.** Parked: Human's
  bundled `mobilefacenet` and `insightface` modules ship with
  non-commercial weights; the MIT license on the runtime does not
  cover them.

Re-opening any of these requires the corresponding blocker to be
resolved first (legal review for dlib weights; commercial dataset for
training; or a new candidate that didn't appear in this iteration).

---

# Embedding Model Evaluation Update — AuraFace-v1 and Commercial Paths

Status: research only.
Added: after the previous conclusion that Category A was empty. A new
candidate, `fal/AuraFace-v1`, surfaced in the ecosystem and is
investigated here alongside the broader "commercially clean model
paths" question.

This update is append-only. The earlier Embedding Model Evaluation
section above is preserved as the baseline; nothing there is deleted.

## A. fal/AuraFace-v1 — detailed investigation

### Repository metadata

- **URL**: <https://huggingface.co/fal/AuraFace-v1>
- **Author / org**: `fal` (the org). Uploader handle `isidentical`
  (Batuhan, et al.). Blog post co-authors include `jfischoff`,
  `aykutkardas`, `gokaygokay`, `multimodalart`, `burkaygur`.
- **Hugging Face license metadata**: `apache-2.0`.
- **`library_name` (Hugging Face metadata)**: `insightface`.
- **Files in repo at HEAD** (per
  <https://huggingface.co/fal/AuraFace-v1/tree/main>):
  - `glintr100.onnx` — 261 MB — the recognition model (FP32, ResNet-100).
  - `1k3d68.onnx` — 144 MB — InsightFace 3D face landmarks.
  - `2d106det.onnx` — 5.03 MB — InsightFace 2D landmarks.
  - `genderage.onnx` — 1.32 MB — InsightFace gender/age.
  - `scrfd_10g_bnkps.onnx` — 16.9 MB — InsightFace SCRFD face detector.
  - `LICENSE.md` — stock Apache 2.0 boilerplate (no NOTICE file, no
    customized rightsholder name).
  - `README.md` — model card.
- **Commit history**: 5 commits, last verified commit ~2 years ago
  (commit `af6d057` for `LICENSE.md`, `94ee6ceb` for the model files,
  `2c3499e6` for the README).
- **SHA256 hashes**: not exposed in the public Hugging Face UI; the
  repo uses `xet` storage which obscures hashes from end users.

### Architecture

- ResNet-100 (InsightFace's IResNet-100 variant) with additive angular
  margin loss (ArcFace-style).
- Embedding dimension: 512.
- Input: 112×112 aligned face crop, RGB, normalized to `[-1, 1]`.
- Output: 512-D unnormalized or L2-normalized embedding depending on
  consumer.
- Source for architecture: <https://huggingface.co/blog/isidentical/auraface>
  ("AuraFace is based on the resnet100 architecture as the original
  ArcFace model").

### Why is `glintr100.onnx` 261 MB?

- The model has ~65 M parameters (per the third-party
  `cstr/auraface-v1-GGUF` README at
  <https://huggingface.co/cstr/auraface-v1-GGUF>: "103 Conv, 49
  residual Add, 50 PReLU", "65.1M params").
- 65.1 M params × 4 bytes (FP32) ≈ 260 MB. The 261 MB file size is
  consistent with FP32 weights plus ONNX graph overhead.
- The naming convention `glintr100` is identical to the naming used
  by InsightFace's `antelopev2` recognition head (`ResNet100@Glint360K`).
  The shared filename is itself a provenance signal — `glintr100`
  has historically referred to InsightFace's IResNet-100 trained on
  Glint360K. Whether AuraFace's `glintr100.onnx` is the same file or
  a re-trained version of the same architecture under the same name
  is the central provenance question.

### Smaller / quantized / distilled variants

| Variant | Format | Approx size | Source | Notes |
|---|---|---|---|---|
| `glintr100.onnx` (FP32) | ONNX | 261 MB | fal/AuraFace-v1 upstream | Original |
| `cstr/auraface-v1-GGUF` F16 | GGUF | ~130 MB | third-party (cstr) | Format conversion only, no re-training. <https://huggingface.co/cstr/auraface-v1-GGUF>. |
| `cstr/auraface-v1-GGUF` Q4/Q5/Q8 | GGUF | ~65 MB / ~80 MB / ~110 MB | third-party (cstr) | Quantization only, no re-training. Same Apache-2.0 inheritance. |
| `auraface-v1-GGUF` for `CrispEmbed` | GGUF | varies | third-party | Same provenance concern. |
| Distilled mobile variants | — | — | none | No distilled AuraFace variant found. |
| Quantized `int8` from fal | — | — | none | fal has not published an int8 variant. |

Even with Q4 quantization the file is ~65 MB, which is still heavy
for Identa's mobile-first browser goal. ResNet-100 is the wrong
backbone for that constraint regardless of quantization.

### Training data description (primary source)

From the README at <https://huggingface.co/fal/AuraFace-v1>:

> "AuraFace is a highly discriminative face recognition model designed
> using the Additive Angular Margin Loss approach. It builds upon the
> principles introduced in ArcFace and has been trained on commercially
> and publicly available data sources to enable its usage in
> commercial setting."

From the same README:

> "AuraFace was trained on a commercial dataset comprising face images
> from various sources. The dataset tries to include a wide range of
> demographics, lighting conditions, and image qualities to ensure
> robust performance across different scenarios, however due to the
> commercial limitation may not extensively cover all ethnicities."

From the fal blog at
<https://huggingface.co/blog/isidentical/auraface>:

> "Unlike the original ArcFace, which has non-commercial restrictions
> due to its training data, AuraFace can be used in commercial projects
> without limitations."

> "However, the significant size difference between the training data
> means that AuraFace does not match the performance of the original
> ArcFace, but it offers a strong balance between accuracy and
> commercial usability."

### License verification — primary source

- The repo's `LICENSE.md` at
  <https://huggingface.co/fal/AuraFace-v1/blob/main/LICENSE.md> is the
  stock Apache License 2.0 text. The rightsholder name is the
  placeholder `[yyyy] [name of copyright owner]` — fal has not
  customized it. No NOTICE file is included.
- The Hugging Face model card declares `license: apache-2.0`.
- **What the Apache 2.0 grant covers**: redistribution rights,
  modification rights, patent grant — but only the rights that fal
  actually holds in the specific files shipped. fal can only grant
  Apache 2.0 on material it owns or controls; the scope of that
  control is exactly what the community is asking fal to clarify.

### What is verified and what is not

| Claim | Verified? | Source |
|---|---|---|
| Repo declares Apache-2.0 | ✅ verified | <https://huggingface.co/fal/AuraFace-v1> metadata + LICENSE.md |
| Architecture is ResNet-100 + ArcFace-style AAM loss | ✅ verified | fal blog, README, third-party benchmarks |
| glintr100.onnx is FP32, 261 MB, 65.1 M params | ✅ verified | cstr/auraface-v1-GGUF README, file metadata |
| glintr100.onnx is **not** the byte-identical InsightFace `antelopev2` recognition file | ⚠ strongly suggested but not verified | Third-party analysis (archledger/irlume) cites accuracy delta as evidence. File-level hash comparison not publicly available. |
| Training data is "commercially and publicly available data sources" | ⚠ claimed, not specified | fal README and blog |
| Specific training datasets used | ❌ not disclosed | fal has not responded to multiple direct requests |
| Training data licensing chain | ❌ not documented | fal has not responded to multiple direct requests |
| fal holds rights to release glintr100.onnx under Apache-2.0 | ⚠ asserted, not proven | fal has not responded to multiple direct requests |
| SHA256 hash of glintr100.onnx | ❌ not publicly disclosed | xet storage obscures end-user hashes |
| Exact commit ID for audit pinning | ⚠ partial — only top-level HEAD visible | |

### Open provenance questions (unresolved as of doc date)

Discussion #8 at
<https://huggingface.co/fal/AuraFace-v1/discussions/8> opens these
questions on **2025-09-29** and has been unanswered by fal for
~9 months despite multiple follow-ups by different users
(`ivantkt` 2026-01-06, `blace-ai` 2026-04-13, `ameyjoshi8198` very
recently):

1. Are `glintr100.onnx` weights original to fal, or copied / derived
   from InsightFace's `antelopev2` / `glintr100`?
2. Which specific training datasets were used, and under what
   license terms?
3. Does fal (as rightsholder) own or control sufficient rights to
   release these specific weights under Apache-2.0?
4. SHA256 / Xet hashes of each model file, exact commit ID for
   audit pinning.
5. NOTICE-file content / required attributions.

The fact that fal has not responded for ~9 months on these questions
is itself a risk signal: a project that actively chose a permissive
license would normally provide short-form provenance confirmation.
Silence is consistent with either (a) internal communication issues
at fal, or (b) inability to confirm the provenance assertion in
writing.

### Third-party provenance signals

- **archledger/irlume** (a GPL-licensed project that uses
  AuraFace's `glintr100.onnx` as its embedding backbone) explicitly
  documents the mixed-license bundle:
  <https://github.com/archledger/irlume/blob/main/models/README.md>:
  > "AuraFace's bundled `scrfd_10g_bnkps.onnx` (and `1k3d68`,
  > `2d106det`, `genderage`): those are InsightFace detection/aux
  > models with **non-commercial** weights. Take only `glintr100.onnx`
  > from that repo; use YuNet for detection."
  And:
  > "fal's model card + blog state AuraFace was trained on a
  > commercial dataset and is for commercial use; the lower-than-
  > ArcFace accuracy confirms independent training (not a re-upload
  > of antelopev2). For belt-and-braces, an issue asking fal to
  > confirm `glintr100.onnx`'s provenance in writing is worthwhile."
- **LibreFaceRec** at <https://www.libreyolo.com/docs/models/librefacerec>
  treats AuraFace as a commercial-safe drop-in for the InsightFace
  buffalo_l 512-D embedding space, on the strength of the Apache-2.0
  metadata:
  > "Apache-2.0 covers the embedding weights (AuraFace-v1's
  > glintr100 recognition head), so they may be used, modified and
  > redistributed, including commercially, provided the license text
  > and attribution notices travel with any copy."
  This is the most permissive interpretation of the metadata. Identa
  should treat it as one opinion, not a license grant.
- **fastface** (bauratynov/fastface, C99 inference engine) is
  explicitly honest about the inheritance problem:
  > "Weights (`models/w600k_r50.onnx` and the derived
  > `models/w600k_r50_ffw4.bin`) are governed by the InsightFace
  > model license (non-commercial use without a separate agreement)."
  Source: <https://github.com/bauratynov/fastface>.
- **MetaLoom's** legal page at <https://metaloom.io/docs/legal/model-licenses/>
  gives the cleanest framing of the divergence between code license
  and weight license:
  > "InspireFace: Code Apache-2.0; model packs follow InsightFace —
  > academic use only."

### Bundle contents — non-commercial contamination

Even if `glintr100.onnx` is independently commercially-usable, the
same HF repo also ships:

- `scrfd_10g_bnkps.onnx` — InsightFace SCRFD detector (Apache-2.0
  code but non-commercial-research-only weights, per InsightFace's
  model_zoo README).
- `1k3d68.onnx` (144 MB), `2d106det.onnx`, `genderage.onnx` — also
  InsightFace auxiliary models with non-commercial-research-only
  weights.

A consumer who naively downloads the AuraFace bundle and uses all
files is therefore in violation of InsightFace's weight license for
4 of the 5 ONNX files. Only `glintr100.onnx` is even a candidate
for Identa's commercial use, and only if its provenance is
ultimately confirmed.

### Public benchmarks (context only, not Identa substitute)

From fal's blog post
(<https://huggingface.co/blog/isidentical/auraface>):

| Metric | AuraFace | ArcFace |
|---|---|---|
| CFP-FP | 95.18 | 98.87 |
| AGEDB | 96.10 | 98.38 |
| CALFW | 94.70 | 96.10 |
| CPLFW | 90.93 | 93.43 |

AuraFace also claims LFW 99.65% per
<https://huggingface.co/fal/AuraFace-v1/blame/686774cad65e40933022896195e07e01ee06bee9/README.md>.

A community benchmark on IPED at
<https://github.com/sepinf-inc/IPED/issues/2823> independently
confirms AuraFace LFW 99.65% and reports ~3× higher CPU latency vs
dlib per face (113 ms vs 36 ms).

A Reddit user report
(<https://www.reddit.com/r/computervision/comments/1oz4ihc/help_with_commercial_face_recognition_model/>)
notes that AuraFace and Facenet512 have notably higher false-positive
rates than buffalo_l, especially on East Asian faces, which is
consistent with the fal blog's own caveat about ethnicity coverage
("due to the commercial limitation may not extensively cover all
ethnicities").

These numbers are **not** a substitute for Identa's own evaluation
on the private benchmark dataset.

### Browser / runtime feasibility

- **ONNX Runtime Web**: ✅ `glintr100.onnx` is a standard ONNX file
  that loads in `onnxruntime-web` WASM and WebGPU backends. The
  archledger/irlume and LibreFaceRec projects already run it via
  ORT.
- **WASM**: ✅ universal support including iOS Safari.
- **WebGPU**: ✅ on Android Chrome, Windows Chrome, macOS Safari TP.
  Not available on iOS Safari as of 2026.
- **WebGL**: not applicable (model is run via ORT, not TF.js).
- **Mobile**: ✅ in principle — runs via ORT Web on a phone. The
  IPED CPU benchmark reports ~113 ms per face which is workable for
  the Identa use case (one comparison per session).
- **Download size**: 261 MB FP32 is too heavy for Identa's
  expectations. Even Q4 GGUF is ~65 MB. Realistic shipping options
  for Identa would be:
  - On-demand streaming from a CDN with the consumer's consent.
  - Or wait for a smaller, genuinely-licensed mobile variant.

### Categorization — fal/AuraFace-v1

| Aspect | Status |
|---|---|
| Repository license (declared) | Apache-2.0 (verified) |
| Weight license (declared) | Apache-2.0 (claimed) |
| Weight provenance | **Unresolved** — primary-source confirmation absent |
| Training data provenance | **Unresolved** — not disclosed |
| Bundle contamination | Confirmed — 4 of 5 ONNX files are non-commercial |
| Architecture fit | ✅ — `FaceEngine.embed(face)` accepts any ONNX embedding model |
| ONNX Runtime Web | ✅ direct |
| Mobile / browser feasibility | ⚠ works, but 261 MB FP32 is heavy |
| Categorization | **Needs provenance/license clarification** |

## B. facex-engine/facex — investigated as a candidate Apache-2.0 native stack

Reason for investigating: the `facex-engine/facex` repository
(<https://github.com/facex-engine/facex>) markets an "Apache 2.0
throughout" full browser face stack with MobileFaceNet variants
ranging from 0.8 MB to 8.4 MB and LFW 95.62–99.07%. The
browser-demo pitch matches Identa's constraints closely.

- **Repository license** (claimed): Apache 2.0.
- **Trained-on dataset (claimed)**: MS1M-RefineV2 (5.82 M images,
  85,742 IDs) per the project's `MFN_README.md` at
  <https://github.com/facex-engine/facex/blob/main/MFN_README.md>:
  > "All trained from scratch on MS1M-RefineV2 (5.82M images, 85,742
  > IDs) with ArcFace (s=64, m=0.5), AdamW lr=1e-3 cosine, fp32. No
  > upstream pretrained weights — fully Apache-licensed."
- **MS1M-RefineV2 is a refinement of MS-Celeb-1M** which is itself
  Microsoft's withdrawn, non-commercial-research-only dataset.
  InsightFace's MS1MV2 / MS1MV3 derivatives inherit the same
  restriction (see earlier Embedding Model Evaluation section).
- **Contradiction to the Apache-2.0 claim**: weights trained on
  MS-Celeb-1M data cannot be relicensed to Apache 2.0 by the model
  author. This is the same code-vs-weight-vs-data-license
  divergence that the MetaLoom legal page documents for
  InspireFace / InsightFace.
- **Categorization**: **Reject for Identa** in the current form.
  The Apache-2.0 metadata does not cover the underlying
  MS-Celeb-1M-trained weights.

The smaller `facex_nano` release
(<https://github.com/facex-engine/facex/releases/tag/facex-nano-1.0>)
ships only the 0.8 MB nano variant (95.62% LFW). The README FAQ
states that the bigger variants (tiny, standard, xs) "are the
licensed ones" requiring contact with the author, which suggests
the larger / better-accuracy variants may have a different license
or rights chain than the nano Apache-2.0 release. Not investigated
further in this pass.

## C. Synthetic face datasets — investigated per the brief

The brief asked us to investigate DCFace, SFace, NVIDIA synthetic
face datasets, and other synthetic face datasets. Findings:

| Dataset | License (primary) | Commercial use? | Source |
|---|---|---|---|
| SFace (Fraunhofer IGD) | CC BY-NC-SA 4.0 | ❌ NC + share-alike | <https://github.com/fdbtrs/SFace-Privacy-friendly-and-Accurate-Face-Recognition-using-Synthetic-Data/blob/master/README.md> |
| DigiFace-1M (Microsoft) | "Other" — non-commercial research only | ❌ NC | <https://github.com/microsoft/DigiFace1M> |
| DCFace (Kim et al., CVPR 2023) | No LICENSE file in repo | ❓ not explicitly stated | <https://github.com/mk-minchul/dcface> (no LICENSE — verified by fetch attempt; the GitHub route returns 404 on the LICENSE branch) |
| NVlabs/ffhq-dataset | CC BY-NC-SA 4.0 + explicit "not intended for facial recognition" | ❌ | <https://github.com/NVlabs/ffhq-dataset> |
| NVlabs StyleGAN2/3 pretrained | Nvidia Source Code License (NC) | ❌ | <https://github.com/NVlabs/stylegan3> |
| CelebA (MMLAB) | Non-commercial research only | ❌ | <https://mmlab.ie.cuhk.edu.hk/projects/CelebA.html> |
| CASIA-WebFace | "only for non-commercial research and educational purposes" | ❌ | <http://www.cbsr.ia.ac.cn/english/casia-webFace/casia-webfAce_AgreEmeNtS.pdf> |
| VGG Face2 (Oxford) | CC BY-NC 4.0 | ❌ | <https://www.robots.ox.ac.uk/~vgg/data/vgg_face/licence.txt> |
| WebFace260M / WebFace600K | Non-commercial-research only | ❌ | <https://www.face-benchmark.org/> |
| MS-Celeb-1M (withdrawn) | Non-commercial-research only | ❌ | withdrawn by Microsoft |

**Important caveat per the brief**: "a synthetic dataset being
available does not automatically make a trained model commercially
clean."

The synthetic-data angle is *promising* in principle — synthetic
data sidesteps consent and dataset-withdrawal issues — but every
major public synthetic face dataset that could be used to train a
face recognition model ships with a non-commercial-research
restriction or a share-alike clause. There is currently no
publicly-available synthetic face dataset that can be used to train
a face recognition model for commercial redistribution without
additional licensing work.

The DCFace case is worth one follow-up: its repository has no
LICENSE file at the time of writing, and the paper's funding source
(IARPA) suggests US-government-funded research, which may have
its own licensing implications. But the absence of an explicit
license is itself a blocker — Identa would not have a primary
source for commercial-use clearance.

## D. ONNX Model Zoo — arcfaceresnet100-8

Reason for investigating: Hugging Face hosts an `onnxmodelzoo`
mirror of the ONNX Model Zoo's ArcFace model with `apache-2.0`
metadata and a downloadable ONNX file. If the metadata and the
underlying weights were both commercial-clean, this would be a
strong candidate.

- **URL**: <https://huggingface.co/onnxmodelzoo/arcfaceresnet100-8>
- **HF metadata**: `license: apache-2.0`, `model_name:
  arcfaceresnet100-8.onnx`.
- **README at** <https://huggingface.co/onnxmodelzoo/arcfaceresnet100-8/raw/36326aa66a9d9bd72def50e9324a1028658b05d8/README.md>
  declares Apache 2.0 and lists the model specs:
  - LResNet100E-IR, 248.9 MB FP32 / 63 MB INT8.
  - LFW 99.77%, CFP-FP 94.21% (FP32); INT8 LFW 99.80% with no
    accuracy drop.
- **README references** include:
  > "Original training dataset from the paper MS-Celeb-1M: A Dataset
  > and Benchmark for Large-Scale Face Recognition."
- **Categorization**: **Reject for Identa** in the current form.
  The Apache-2.0 file metadata does not extend to the MS-Celeb-1M
  training data restriction. This is the same code-vs-data
  divergence that disqualifies `facex-engine/facex` and
  `onnxmodelzoo/arcfaceresnet100-8`.
- **Bonus**: INT8 quantization is documented at 63 MB with no
  accuracy loss, which is informative for any future
  quantization-aware training / post-training quantization work
  Identa might do on its own weights.

## E. Other Apache-2.0 metadata candidates investigated briefly

These were considered but rejected by the same pattern: the
weights are Apache-2.0 at the file level but the underlying
training data is non-commercial-research-only.

- **`opencv/face_recognition_sface`** (Hugging Face) — Apache 2.0
  file metadata; SFace dataset is CC BY-NC-SA 4.0. Source:
  <https://huggingface.co/opencv/face_recognition_sface>.
- **`onnxmodelzoo/arcfaceresnet100-8`** — covered above.
- **`facex-engine/facex`** MobileFaceNet variants — MS-Celeb-1M
  lineage, Apache-2.0 metadata insufficient. Source:
  <https://github.com/facex-engine/facex>.
- **`onnxmodelzoo/UltraFace`** — face detector, not an embedding
  model. Out of scope for this evaluation.
- **LocalAI's `face-detect-yunet-sface`** recommendation — they
  document at <https://localai.io/docs/features/face-recognition/index.html>
  that SFace is "Apache 2.0 - commercial-safe". Same pattern: the
  SFace weights are tagged Apache 2.0 but CASIA-WebFace training
  data is NC.

## Commercially Clean Model Paths

This section maps the brief's four required path categories against
what the ecosystem currently offers.

### Path A — Existing pretrained model with sufficiently documented commercial rights

**Empty.** No candidate in the open face-recognition ecosystem has
both (a) Apache-2.0 / MIT / similar permissive file-level license
**and** (b) primary-source-documented training data rights
sufficient to clear the chain `dataset → weights → model card → user`.

This was the case before this update (see previous Embedding Model
Evaluation section) and remains the case after the AuraFace-v1
investigation.

### Path B — Existing model with unresolved provenance

Candidates that pass file-level license scrutiny but for which
training-data or rights-chain evidence is missing or contradicted:

| Candidate | What is documented | What is unresolved |
|---|---|---|
| `dlib face_recognition_resnet_model_v1` | CC0 weight grant; trained on FaceScrub + VGG Face + scraped images | Whether CC0 grant on weights overrides CC-BY-NC on VGG Face portion of training data |
| `fal/AuraFace-v1 glintr100.onnx` | Apache-2.0 metadata + blog claiming "commercial dataset" | Specific dataset, training-data license, independent provenance confirmation; fal has not responded to multiple provenance requests |

Both are technically deployable today but cannot be shipped
without either (a) a written license grant from the rights holder,
or (b) a legal opinion specific to Identa's use case.

### Path C — Train / fine-tune on explicitly licensed commercial-clean data

This is the most promising long-term path but is blocked at the
data-acquisition layer.

- **Synthetic face datasets**: every major synthetic face dataset
  investigated (SFace, DigiFace-1M, DCFace, FFHQ) ships with
  non-commercial-research or share-alike restrictions. See the
  Synthetic Datasets section above.
- **Real face datasets**: every major real face dataset
  (CelebA, CASIA-WebFace, VGGFace2, WebFace260M, MS-Celeb-1M and
  derivatives) is non-commercial-research-only. Many (MS-Celeb-1M
  itself) have been withdrawn.
- **The DCFace gap**: the DCFace paper has no LICENSE in the GitHub
  repo and uses IARPA funding. US-government-funded research
  outputs may carry a specific license. Follow-up research could
  confirm whether DCFace is releasable under permissive terms.

**Out of scope per the brief**: training from scratch is not
recommended at this stage. The brief explicitly says "Do NOT
recommend training from scratch yet."

### Path D — Train / fine-tune using Identa's own consented company data

Identa has no first-party consented data today. Building this
requires:

1. A user-consent mechanism with a DPIA (Data Protection Impact
   Assessment) that satisfies GDPR / Indonesian PDP Law (UU PDP)
   for biometric data.
2. Storage infrastructure with appropriate access controls.
3. Data retention policy and deletion infrastructure.

All three are out of scope for the current MVP and are explicitly
deferred per AGENTS.md §3 ("Do not prematurely implement:
merchant dashboard, authentication, billing, multi-tenancy,
organizations, API key management, analytics, OCR, NIK extraction,
biometric database").

The brief calls this Path D out as a future option, contingent on
"company authorization and applicable data governance". It is not
an MVP path.

## Two-stage strategy assessment

The brief asks whether Identa could ship a two-stage strategy:

- **Phase 1**: deploy a commercially-usable pretrained embedding
  model → benchmark on private dataset → calibrate threshold.
- **Phase 2**: fine-tune / distill only if necessary.

Findings:

### Phase 1 feasibility

Phase 1 requires a Phase-1 candidate. The candidates that pass
file-level scrutiny are limited to Path B:

- **dlib CC0 weights** — but the VGG Face training-data question
  remains unresolved. A legal review specific to Identa would
  resolve it, but no public primary source does.
- **fal/AuraFace-v1 glintr100.onnx** — but fal's silence on
  provenance requests means Identa would need to either (a)
  decide the Apache-2.0 metadata is sufficient on its own, or
  (b) attempt to get a written confirmation from fal (which
  has not been forthcoming in ~9 months).

In either case, Phase 1 with a pretrained model ships with a
legal-clarification dependency. This is workable but requires
explicit owner sign-off.

### Phase 2 feasibility

Phase 2 (fine-tune / distill) is viable only if Phase 1 has
established a working pipeline AND a base model that can be
fine-tuned on commercial-clean data. The base-model choice is
constrained by the same license chain. The fine-tuning data
must come from a commercially-clean source — which brings us
back to Path C / D and the data-acquisition blocker.

Distillation from a Path B model is technically possible (the
ONNX format supports weight transfer) but does not by itself
clean the rights chain; the distilled weights inherit the base
model's data lineage in spirit if not in strict copyright.

### Recommendation against a two-stage strategy today

The two-stage strategy is sound in principle but cannot be
activated yet because Phase 1 has no Path A candidate. Identa
would have to either:

- Accept Path B with a documented legal review (recommended near-term path).
- Or invest in Path D (first-party consented data) before any production use.

If Phase 1 is forced via Path B with the legal review, Phase 2
is still gated on data acquisition for fine-tuning. This means
the two-stage strategy becomes a single-stage strategy in
practice until Path C / D becomes viable.

## Updated categories

### Potentially usable

**Empty.** No candidate has all of: documented permissive license
**AND** documented training-data rights **AND** fit for browser /
mobile first deployment.

### Needs provenance / license clarification

- **dlib face_recognition_resnet_model_v1** — CC0 weights,
  CC-BY-NC training-data partial overlap (VGG Face). Carried
  forward from the previous evaluation.
- **fal/AuraFace-v1 glintr100.onnx** — Apache-2.0 metadata,
  training data undisclosed, fal team has not responded to
  multiple provenance requests in ~9 months. New in this update.

### Technically unsuitable

- **facex-engine/facex MobileFaceNet variants** — Apache-2.0
  metadata, but MS-Celeb-1M lineage makes the metadata
  insufficient. Browser-first pipeline otherwise matches Identa's
  goals very well (facex-engine ships ORT Web + AES-encrypted
  weights + browser demo).
- **ONNX Model Zoo `arcfaceresnet100-8`** — Apache-2.0 metadata,
  MS-Celeb-1M training data. INT8 quantization is documented
  (63 MB with no accuracy loss) which is useful for any future
  quantization work.
- **opencv/face_recognition_sface** — Apache-2.0 metadata, CC
  BY-NC-SA 4.0 dataset. LocalAI explicitly recommends this for
  commercial use; the recommendation inherits the same gap.

### Reject

- All InsightFace pretrained model packs (`buffalo_l`, `buffalo_s`,
  `buffalo_m`, `buffalo_sc`, `antelopev2`). Same as previous
  evaluation.
- davidsandberg FaceNet (VGGFace2 / CASIA-WebFace / MS-Celeb-1M
  ckpts). Same as previous evaluation.
- Foamliu MobileFaceNet (Apache-2.0 code, MS-Celeb-1M weights).
- Sirius-AI MobileFaceNet_TF (Apache-2.0 code, MS1M-refine-v2
  weights).
- All synthetic face datasets investigated (SFace, DigiFace-1M,
  DCFace, FFHQ) for the purpose of training Identa's own model.
- Hailo Model Zoo ArcFace MobileFaceNet (MIT metadata,
  MS1MV3 weights).

## Summary

After this update, **Category A remains empty**. The most
realistic near-term path is still Path B (legal review on dlib
CC0 weights or on AuraFace-v1 Apache-2.0 metadata) combined with
a documented risk acceptance. The two-stage strategy is
conceptually sound but blocked at the data layer.

Identa's most defensible near-term move is one of:

1. Ship with the **dlib CC0 model** under a documented legal
   opinion that the CC0 weight grant overrides the CC-BY-NC
   restriction on the VGG Face portion of the training data.
   This is the lowest-risk option technically (CC0 is explicit)
   but has the smallest mobile-format upside (TF.js runtime
   path, ResNet-34 architecture, 128-D embedding).
2. Ship with **fal/AuraFace-v1 glintr100.onnx** under Identa's
   own acceptance that the Apache-2.0 metadata is sufficient
   absent contrary evidence. This gives best accuracy / mobile
   compatibility (InsightFace-compatible 512-D embedding,
   standard ONNX Runtime Web path, drop-in for buffalo_l) but
   carries residual provenance risk that fal has not addressed
   in ~9 months of community requests.
3. Defer shipping any face-recognition model until Path A or
   Path C is feasible. Identa can still ship the `@identa/core`
   verify primitive, the benchmark harness, and a stub
   `EmbeddingEngine` adapter; production deployment waits on
   data-acquisition work.

Recommended next research direction:

- **Open a direct written exchange with fal** about AuraFace-v1
  provenance. Until then, the model is in Path B and Identa
  should treat it as "available with legal risk" not "verified
  commercial-clean".
- **Investigate DCFace licensing** more deeply. The IARPA-funded
  research may have a US-government-purpose-rights license that
  is compatible with commercial use. If so, DCFace + an
  Identa-trained MobileFaceNet head could be the closest thing
  to a Path C scenario currently available.
- **Investigate synthetic face generation with a permissively-
  licensed generator** as a forward path. Options to evaluate:
  Identa-generated synthetic data via a permissively-licensed
  StyleGAN / diffusion checkpoint, with documented dataset
  card.

## Sources (added in this update)

- fal/AuraFace-v1 repository: <https://huggingface.co/fal/AuraFace-v1>
- fal/AuraFace-v1 LICENSE.md: <https://huggingface.co/fal/AuraFace-v1/blob/main/LICENSE.md>
- fal/AuraFace-v1 files: <https://huggingface.co/fal/AuraFace-v1/tree/main>
- fal/AuraFace-v1 provenance discussion #8: <https://huggingface.co/fal/AuraFace-v1/discussions/8>
- fal AuraFace blog post: <https://huggingface.co/blog/isidentical/auraface>
- cstr/auraface-v1-GGUF (third-party quantization): <https://huggingface.co/cstr/auraface-v1-GGUF>
- archledger/irlume bundle-license warning: <https://github.com/archledger/irlume/blob/main/models/README.md>
- LibreFaceRec license page: <https://www.libreyolo.com/docs/models/librefacerec>
- IPED AuraFace vs dlib benchmark: <https://github.com/sepinf-inc/IPED/issues/2823>
- Reddit AuraFace vs InsightFace report: <https://www.reddit.com/r/computervision/comments/1oz4ihc/help_with_commercial_face_recognition_model/>
- facex-engine/facex repo: <https://github.com/facex-engine/facex>
- facex-engine/facex MFN_README: <https://github.com/facex-engine/facex/blob/main/MFN_README.md>
- facex-engine/facex nano release: <https://github.com/facex-engine/facex/releases/tag/facex-nano-1.0>
- onnxmodelzoo/arcfaceresnet100-8: <https://huggingface.co/onnxmodelzoo/arcfaceresnet100-8>
- bauratynov/fastface (explicit non-commercial inheritance): <https://github.com/bauratynov/fastface>
- MetaLoom legal page (code vs weight license divergence): <https://metaloom.io/docs/legal/model-licenses/>
- LocalAI face-recognition gallery: <https://localai.io/docs/features/face-recognition/index.html>
- opencv/face_recognition_sface: <https://huggingface.co/opencv/face_recognition_sface>
- SFace repository license: <https://github.com/fdbtrs/SFace-Privacy-friendly-and-Accurate-Face-Recognition-using-Synthetic-Data/blob/master/README.md>
- Microsoft DigiFace-1M license statement: <https://github.com/microsoft/DigiFace1M>
- NVlabs/ffhq-dataset (NC-SA + "not for facial recognition"): <https://github.com/NVlabs/ffhq-dataset>
- NVlabs StyleGAN3 (NC): <https://github.com/NVlabs/stylegan3>
- MMLAB CelebA: <https://mmlab.ie.cuhk.edu.hk/projects/CelebA.html>
- CASIA-WebFace agreement: <http://www.cbsr.ia.ac.cn/english/casia-webFace/casia-webfAce_AgreEmeNtS.pdf>
- InsightFace model_zoo (pre-existing): <https://github.com/deepinsight/insightface/blob/master/model_zoo/README.md>


