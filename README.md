# Identa

Open-source identity verification infrastructure.

## Status

Pre-MVP. Face-matching proof of concept.

## Goals

- KTP image + selfie → face detection → embedding → similarity → verification result
- Small · Portable · Privacy-first · Open-source · Self-hostable · Composable

## Structure

```
packages/
  core/            Framework-independent verification core
  web-component/   <identa-verification> UI primitive
engines/
  face/            Face detection + embedding engine
apps/
  demo/            Hosted demo
examples/
  html/            Plain HTML usage examples
```

See `AGENTS.md` for full contributor guidelines.
