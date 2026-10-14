# Image-to-3D composition (2026-10-14)

The GPU image adapter now appends a single diagonal three-quarter viewpoint, a slightly elevated camera, full-subject framing with margin, a plain white background, and soft even lighting. It records the actual positive/negative prompts and `compositionVersion: 2` with each new image. The original translated subject stays first and is not converted into a toy or prop.

## Fixed-seed visual comparison

All runs used the existing `coedit/gpu` BullMQ queue with global concurrency 1, SDXL-base-1.0 fp16 revision `462165984030d82259a11f4367a4eed129e94a7b`, 25 steps, 768×768, and RTX 5060 Ti. New room/actor IDs gave each comparison a fresh execution/output directory while preserving the original input jobId/version and therefore the seed. No worker restart, direct GPU process, or user scene mutation was needed. Qwen3:4b prepared the same `A chair` / `A cat` subjects in both comparison runs.

An initial composition prompt included `three-quarter view, front and one side visible`. At chair seed 369451964 this produced **two frontal chairs** despite the single-subject and negative prompts. The hypothesis was that enumerating front and side could encourage multiple depicted views. Replacing just `front and one side visible` with `viewed diagonally from the side` produced **one complete chair with a clearly visible side and seat depth** at the same seed. This supports the replacement for this case; it does not establish a universal cause of duplication.

| Sample | Seed | Result | Evidence |
|---|---:|---|---|
| Initial chair | 369451964 | Two frontal chairs; unsuitable | [Before](image-composition/chair-before.png) |
| Revised chair | 369451964 | One chair, diagonal view, complete legs and margins | [After](image-composition/chair-after.png) |
| Revised cat | 1464568586 | One living cat, oblique face/body, paws and tail inside frame | [Cat](image-composition/cat-after.png) |

Revised queue executions:

- Cat: `gpu-4310ab70223bbf082384ca6a108bd4002d25b2913bfab9120dbb71d0a2e8965f`; `.cache/jobs/8574c367fb0d16604389270642b86c3e4fa056a6bc546289fa17154e048420a6`; GPU-stage time 18.281 s.
- Chair: `gpu-410de2a6f1fb3da7c19b9309e0561b6ed7d125f0863012d9ed393f16dd6718ad`; `.cache/jobs/55edf637cb819d19d7e25341a0dfbc13187fae5e1eb3a640891e00ad9e40431c`; GPU-stage time 18.918 s.

The cached `prompt.json`, `image.png.json`, and `result.json` retain original/prepared prompts, seed, composition instructions, timing, and artifact identity. The initial chair directory is `.cache/jobs/94306c43ac052056107a39e2b0d01ee23767b3c791af02d24b00015683eb5606`.

## Validation and limits

- `.venv/Scripts/python.exe -m pytest workers/gpu/tests -q`: **14 passed**.
- `npm run check:modules`: **PASS** (boundaries and import cycles).
- Responsibility remains within the image adapter; queue contracts, permission/scene commands, and UI are unchanged by this composition change. The pure prompt function is independently testable without GPU/model loading.

This is a text prompt preference, not calibrated camera control. The model can still ignore pose, duplicate objects, invent details, or fail complex subject relations. These two inspected revised images establish a local improvement, not a measured general success rate or improved downstream mesh accuracy. They were not sent to shape reconstruction for this comparison. The existing student image confirmation step remains necessary before starting 3D generation. Existing images are not regenerated automatically.
