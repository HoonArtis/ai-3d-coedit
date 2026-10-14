# Local GPU adapters

Run from the repository root with `.venv/Scripts/python.exe -m workers.gpu.prepare_vendor`, then `-m workers.gpu.prepare_models --help` for explicit pinned downloads. The worker (`npm run dev:gpu`) uses this interpreter and `.data/objects`, shared with the server. `GPU_PYTHON` and `OBJECT_STORE_DIR` can override those local paths. It never installs models at inference time.

The validated Windows environment is recorded in `docs/evidence/gpu-environment.json`. This PC already had CUDA PyTorch/diffusers/transformers. The project venv uses `--system-site-packages` read-only and adds trimesh, omegaconf, jaxtyping and scikit-image locally; it does not modify the global environment. A fresh computer must first provision compatible CUDA PyTorch versions. The environment manifest documents the actual run, not a claim that all platforms support the same wheels.

TripoSG's original NumPy 1.22.3 pin is incompatible with this Python 3.11 environment's prebuilt wheels. NumPy 2.4.6 was exercised in the actual image/background/shape smoke runs. This is a deliberate tested deviation. The optional DISO import patch enables official `use_flash_decoder=False`; DISO is not installed. Upstream MIT notice is preserved in `docs/licenses/triposg-MIT.txt`. The model revision is pinned separately in `prepare_models.py`.

RMBG-1.4 is research only. Do not use this path for a sales build without an appropriate license or the approved replacement. The adapter uses the locally audited Python model definition from TripoSG instead of fetching arbitrary remote code.

Each queue execution writes a content-addressed output and an atomic receipt after successful completion. Retry reuses a completed receipt, while a crash before publication may recompute. Partial stage files are never published. GPU processes run serially, are bounded to ten minutes per stage, and are terminated on cancellation/shutdown. The server's durable outbox keeps queue delivery retryable after Redis/server restart.

Run `-m workers.gpu.prepare_vendor --texture` after updating the code: its repeatable UVAtlas compatibility patch removes float32-degenerate triangles after mesh preprocessing. See `docs/evidence/texture-uv-repair.md`. Changes to shared contracts also require restarting idle CPU/LLM workers, not just the web server.

The texture image targets the server's RTX 50 series (`TORCH_CUDA_ARCH_LIST=12.0`). On RTX 30 series build it with `--build-arg TORCH_CUDA_ARCH_LIST=8.6`. On cards under 16GB set `TEXTURE_SEQUENTIAL_OFFLOAD=1` (slower, peak ~8.3GB). Texture A/B: `npx tsx tools/texture-ab.ts <dir>`; see `docs/evidence/texture-reference-alpha.md`.
