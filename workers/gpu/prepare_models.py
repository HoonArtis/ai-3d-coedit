"""Explicit, revision-pinned downloads; inference must use local_files_only."""
import argparse
from pathlib import Path
from huggingface_hub import snapshot_download

MODELS = {
    "mvadapter": ("huanngzh/mv-adapter", "6de4033df6b53366f3c009d22f5ec434bb55e59f", ["mvadapter_ig2mv_sdxl.safetensors", "README.md", "LICENSE*"]),
    "sdxl-vae-fix": ("madebyollin/sdxl-vae-fp16-fix", "207b116dae70ace3637169f1ddd2434b91b3a8cd", ["config.json", "diffusion_pytorch_model.safetensors", "README.md", "LICENSE*"]),
    "sdxl": ("stabilityai/stable-diffusion-xl-base-1.0", "462165984030d82259a11f4367a4eed129e94a7b", ["model_index.json", "LICENSE*", "README.md", "*/config.json", "scheduler/*", "tokenizer/*", "tokenizer_2/*", "text_encoder/*.fp16.safetensors", "text_encoder_2/*.fp16.safetensors", "unet/*.fp16.safetensors", "vae/*.fp16.safetensors"]),
    "triposg": ("VAST-AI/TripoSG", "2c1c516d22d58db486a058d98d31bb6177344e06", ["*.json", "*.safetensors", "README.md", "LICENSE*"]),
    "rmbg": ("briaai/RMBG-1.4", "2ceba5a5efaec153162aedea169f76caf9b46cf8", ["config.json", "preprocessor_config.json", "model.safetensors", "README.md"]),
}
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("model", choices=MODELS)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    repo, revision, files = MODELS[args.model]
    snapshot_download(repo_id=repo, revision=revision, allow_patterns=files, local_dir=root / ".cache" / "models" / args.model, token=False, max_workers=3)
    print(f"READY {args.model} {revision}")
