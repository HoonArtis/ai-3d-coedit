from pathlib import Path
import warnings
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[3]

def load_image(path: Path) -> Image.Image:
    path = Path(path)
    if not path.is_file() or path.stat().st_size > 10 * 1024 * 1024:
        raise ValueError('INVALID_IMAGE_SIZE')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(path) as image:
                if image.format not in ('PNG', 'JPEG', 'WEBP'):
                    raise ValueError('UNSUPPORTED_IMAGE')
                if min(image.size)<16 or image.width*image.height>8_388_608:
                    raise ValueError('INVALID_IMAGE_DIMENSIONS')
                image.verify()
            with Image.open(path) as image:
                return image.convert('RGBA')
    except (OSError, UnidentifiedImageError, Image.DecompressionBombWarning, Image.DecompressionBombError) as error:
        raise ValueError('INVALID_IMAGE') from error

def generate_image(prompt: str, output: Path, seed: int = 42, steps: int = 25):
    if not prompt.strip(): raise ValueError('EMPTY_PROMPT')
    if len(prompt)>2000: raise ValueError('PROMPT_TOO_LONG')
    import torch
    from diffusers import StableDiffusionXLPipeline
    model = ROOT / '.cache/models/sdxl'
    if not (model/'model_index.json').is_file(): raise ValueError('MODEL_MISSING')
    pipeline = StableDiffusionXLPipeline.from_pretrained(str(model), torch_dtype=torch.float16, variant='fp16', use_safetensors=True, local_files_only=True, add_watermarker=False)
    pipeline.enable_model_cpu_offload()
    with torch.inference_mode():
        image = pipeline(prompt=prompt+', full subject centered, isolated on a white background, studio lighting', negative_prompt='cropped, text, watermark, multiple objects, gore, nudity', height=768,width=768,num_inference_steps=steps,generator=torch.Generator('cpu').manual_seed(seed)).images[0]
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    image.save(output,format='PNG')
    return {'model':'sdxl-base-1.0','revision':'462165984030d82259a11f4367a4eed129e94a7b','seed':seed,'steps':steps,'width':image.width,'height':image.height}
