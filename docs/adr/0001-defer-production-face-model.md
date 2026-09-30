# ADR 0001: Defer production face model selection

Status: Accepted (active).

Date: 2026.

## Context

Identa's MVP goal is a working face verification primitive. The
core verification pipeline (`@identa/core`) is now defined. To ship
a working engine, a production face embedding model must be
selected.

Two parallel research passes were conducted in
`docs/research/face-engine-evaluation.md`:

1. A pre-existing evaluation across dlib, InsightFace buffalo family,
   davidsandberg FaceNet, MobileFaceNet derivatives, etc.
2. A targeted follow-up focused on `fal/AuraFace-v1` and other
   candidates marketed as commercially usable.

The objective of the research was to find a candidate that has:

- a permissive file-level license (e.g. Apache-2.0, MIT);
- a permissive training-data license;
- fit for Identa's browser-first, mobile-first, privacy-first,
  self-hostable posture.

## Findings

The combined research concluded:

- **No Category A candidate** (clean code + weights + training data
  license chain) was identified across either research pass.
- **`dlib face_recognition_resnet_model_v1`** — weights are CC0 (public
  domain) but were trained on VGG Face (CC-BY-NC 4.0) + FaceScrub +
  scraped images. Whether CC0 on the weights overrides the CC-BY-NC
  on the training data is a legal question with no primary-source
  answer. **Category B** (clarification).
- **`fal/AuraFace-v1 glintr100.onnx`** — Apache-2.0 metadata on the file
  and the bundle's `LICENSE.md` (stock Apache boilerplate, no NOTICE
  file, no customized rightsholder name). Training data is described
  only as "commercially and publicly available data sources" with no
  specifics. Multiple community requests for provenance confirmation
  (Hugging Face discussion #8, opened 2025-09-29) have not received a
  response from fal in ~9 months. Bundle ships with 4 non-commercial
  InsightFace auxiliary models. **Category B** (clarification).
- **All other investigated candidates** are Category C (reject):
  InsightFace buffalo family, davidsandberg FaceNet, foamliu
  MobileFaceNet, Sirius-AI MobileFaceNet, onnxmodelzoo ArcFace,
  opencv SFace, facex-engine MobileFaceNet, Hailo ArcFace MobileFaceNet.
  Common pattern: Apache-2.0 / MIT file-level license + non-commercial
  training data (MS-Celeb-1M, VGGFace2, WebFace600K, CASIA-WebFace,
  FFHQ derivatives).
- **Synthetic face datasets** that could enable Identa to train its
  own model (SFace, DigiFace-1M, DCFace, FFHQ) are all non-commercial
  or share-alike. No permissively-licensed synthetic face dataset was
  found.
- **First-party consented data** (Path D) does not exist. Acquiring it
  requires consent infrastructure, DPIA, and storage policy that are
  outside the current MVP scope.

## Decision

**Defer production face model selection.**

The Identa architecture is to remain engine-agnostic. `@identa/core`
continues to expose the `FaceEngine` interface and a `MockFaceEngine`
for tests. No production engine adapter is shipped until a Category A
candidate is identified, or until the existing Category B candidates
are cleared through documented legal review.

## Consequences

### Positive

- `@identa/core` stays framework-independent and free of any model
  dependency. Consumers can swap implementations without touching core.
- No legal risk is taken on by shipping a specific model that has
  unresolved provenance.
- Identa has time to develop Path C (train on permissively-licensed
  data) or Path D (first-party consented data) without blocking the
  architectural work.
- The benchmark harness (`tools/benchmark/`) is built and ready to
  evaluate candidates once they are cleared.

### Negative

- The MVP does not ship with a working end-to-end verification flow.
  Consumers must provide their own `FaceEngine` implementation or wait.
- A demo / POC cannot be published without an engine adapter.
- Pressure to relax this decision may grow as the project matures.
  Any relaxation must go through a new ADR with explicit license
  documentation.

### Neutral

- The `FaceEngine` interface, `FaceEngineError` class, and
  `MockFaceEngine` test fixture are all shipped now. The cost of
  re-introducing a production engine later is small — pick an
  implementation, pass it to `verify()`.

## Conditions for revisiting this decision

This decision should be revisited when at least one of the following
becomes true:

1. fal provides written confirmation of AuraFace-v1's training data
   lineage, sufficient for Identa's legal counsel to clear it.
2. A new face embedding model is released under a license chain
   (code + weights + training data) that is independently verifiable
   for commercial use.
3. Identa has acquired a permissively-licensed face dataset (Path C)
   and trained its own model on it.
4. Identa has built first-party consented data infrastructure (Path D).

If any of these resolve, a follow-up ADR must document the new
candidate's license chain (code license + weight license + training
data license) with primary-source URLs before any production ship.

## Alternatives considered

### Ship AuraFace-v1 immediately with risk acceptance

- **Pros**: highest accuracy / mobile compatibility in the open
  ecosystem; InsightFace-compatible 512-D embedding space.
- **Cons**: fal has not responded to provenance requests for ~9
  months. Shipping without written confirmation is a legal risk
  Identa is not in a position to absorb.
- **Decision**: rejected. Defer until fal responds or another
  Category A candidate appears.

### Ship dlib CC0 model with internal legal opinion

- **Pros**: lowest ambiguity at the file level (CC0 is explicit and
  unconditional on the weights).
- **Cons**: requires Identa to obtain a legal opinion specific to
  CC-BY-NC training data inheritance, which is currently out of
  scope. Smaller accuracy / older architecture than alternatives.
- **Decision**: deferred. If a legal opinion is obtained, this is
  the lowest-risk path.

### Ship `@vladmandic/face-api` with TF.js runtime

- **Pros**: WASM-capable runtime via the maintained fork; small
  embedding model.
- **Cons**: deprecated in earlier research because face-api.js
  0.22.2 hard-pins to tfjs-core 1.7.0 (predates WASM backend).
  vladmandic/face-api would re-resolve the WASM conflict but the
  underlying embedding model is still dlib CC0 weights with the same
  VGG Face training-data question.
- **Decision**: rejected. Same blocker as the dlib path; does not
  add value beyond it.

### Train Identa's own model on synthetic face data

- **Pros**: in principle Path A — full control over training data
  license.
- **Cons**: no permissively-licensed synthetic face dataset is
  currently available. Building one is a multi-month effort.
- **Decision**: deferred. Documented as a future direction.

## Related

- `docs/research/face-engine-evaluation.md` — full research log.
- `docs/architecture/face-engine.md` — engine contract.
- AGENTS.md §18 — development priority order (face matching POC
  first, then engine evaluation, then core, then web component).
