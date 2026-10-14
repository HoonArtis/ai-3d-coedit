"""Research-only MV-Adapter runner for the pinned Linux container. Offline weights."""
import argparse,json,os,sys,time,gc
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.cache/MV-Adapter'))

def run(mesh:Path,image:Path|None,output:Path,prompt:str,steps:int=30,resolution:int=512):
    import torch
    from diffusers import AutoencoderKL
    if image is None:
        from mvadapter.pipelines.pipeline_mvadapter_t2mv_sdxl import MVAdapterT2MVSDXLPipeline as Pipeline
        from scripts.inference_tg2mv_sdxl import run_pipeline
    else:
        from mvadapter.pipelines.pipeline_mvadapter_i2mv_sdxl import MVAdapterI2MVSDXLPipeline as Pipeline
        from scripts.inference_ig2mv_sdxl import run_pipeline
    from mvadapter.models.attention_processor import DecoupledMVRowColSelfAttnProcessor2_0
    from mvadapter.schedulers.scheduling_shift_snr import ShiftSNRScheduler
    from mvadapter.pipelines.pipeline_texture import TexturePipeline,ModProcessConfig
    from mvadapter.utils import make_image_grid
    start=time.perf_counter();torch.cuda.reset_peak_memory_stats()
    vae=AutoencoderKL.from_pretrained(str(ROOT/'.cache/models/sdxl-vae-fix'),torch_dtype=torch.float16,local_files_only=True)
    pipe=Pipeline.from_pretrained(str(ROOT/'.cache/models/sdxl'),vae=vae,torch_dtype=torch.float16,variant='fp16',use_safetensors=True,local_files_only=True,add_watermarker=False)
    pipe.scheduler=ShiftSNRScheduler.from_scheduler(pipe.scheduler,shift_mode='interpolated',shift_scale=8.0,scheduler_class=None)
    pipe.init_custom_adapter(num_views=6,self_attn_processor=DecoupledMVRowColSelfAttnProcessor2_0)
    pipe.load_custom_adapter(str(ROOT/'.cache/models/mvadapter'),weight_name='mvadapter_tg2mv_sdxl.safetensors' if image is None else 'mvadapter_ig2mv_sdxl.safetensors')
    pipe.to(dtype=torch.float16);pipe.cond_encoder.to(device='cuda',dtype=torch.float16)
    # 512 peaks ~11.6GB reserved on a 16GB card. TEXTURE_SEQUENTIAL_OFFLOAD=1 trades speed for fitting smaller cards.
    pipe.enable_vae_slicing();pipe.enable_sequential_cpu_offload() if os.environ.get('TEXTURE_SEQUENTIAL_OFFLOAD')=='1' else pipe.enable_model_cpu_offload()
    output.parent.mkdir(parents=True,exist_ok=True)
    condition={'negative_prompt':'watermark, ugly, deformed, noisy, blurry, low contrast'} if image is None else {'image':str(image)}
    images=run_pipeline(pipe,mesh_path=str(mesh),num_views=6,text=prompt,height=resolution,width=resolution,num_inference_steps=steps,guidance_scale=7.0 if image is None else 3.0,seed=42,device='cuda',**condition)[0]
    views=output.with_suffix('.views.png');make_image_grid(images,rows=1).save(views)
    del pipe,vae;gc.collect();torch.cuda.empty_cache()
    # Official UV completion path; no hidden BiRefNet/LaMA/RealESRGAN downloads.
    texture=TexturePipeline(upscaler_ckpt_path=None,inpaint_ckpt_path=None,device='cuda')
    result=texture(mesh_path=str(mesh),save_dir=str(output.parent),save_name=output.stem,uv_unwarp=True,preprocess_mesh=True,uv_size=4096,rgb_path=str(views),rgb_process_config=ModProcessConfig(view_upscale=False,inpaint_mode='uv'),camera_azimuth_deg=[x-90 for x in [0,90,180,270,180,180]])
    rendered=Path(result.shaded_model_save_path)
    if not rendered.is_file():raise ValueError('MISSING_TEXTURE_OUTPUT')
    if rendered.resolve()!=output.resolve():output.write_bytes(rendered.read_bytes())
    report={'model':'huanngzh/mv-adapter','revision':'6de4033df6b53366f3c009d22f5ec434bb55e59f','codeRevision':'4277e0018232bac82bb2c103caf0893cedb711be','mode':'research-only-nvdiffrast','condition':'text-geometry' if image is None else 'image-geometry','completion':'OpenCV CPU Telea UV padding; official mesh preprocessing; no neural upscaler/inpainter','resolution':resolution,'uvSize':4096,'steps':steps,'seed':42,'seconds':round(time.perf_counter()-start,3),'peakAllocatedMiB':round(torch.cuda.max_memory_allocated()/1024**2,1),'peakReservedMiB':round(torch.cuda.max_memory_reserved()/1024**2,1)}
    output.with_suffix(output.suffix+'.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--mesh',required=True);parser.add_argument('--image');parser.add_argument('--output',required=True);parser.add_argument('--prompt',required=True);parser.add_argument('--steps',type=int,default=30);parser.add_argument('--resolution',type=int,default=512)
    args=parser.parse_args();run(Path(args.mesh),Path(args.image) if args.image else None,Path(args.output),args.prompt,args.steps,args.resolution)
