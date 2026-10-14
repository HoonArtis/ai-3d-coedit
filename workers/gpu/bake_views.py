"""Bake an edited 6-view grid onto a mesh (experiment: student-provided views replacing generated ones).
Same TexturePipeline settings as run_texture.py; the grid order is MV-Adapter's [front, right, back, left, top, bottom]."""
import argparse,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.cache/MV-Adapter'))

def bake(mesh:Path,views:Path,output:Path):
    from mvadapter.pipelines.pipeline_texture import TexturePipeline,ModProcessConfig
    texture=TexturePipeline(upscaler_ckpt_path=None,inpaint_ckpt_path=None,device='cuda')
    result=texture(mesh_path=str(mesh),save_dir=str(output.parent),save_name=output.stem,uv_unwarp=True,preprocess_mesh=True,uv_size=4096,rgb_path=str(views),rgb_process_config=ModProcessConfig(view_upscale=False,inpaint_mode='uv'),camera_azimuth_deg=[x-90 for x in [0,90,180,270,180,180]])
    rendered=Path(result.shaded_model_save_path)
    if rendered.resolve()!=output.resolve():output.write_bytes(rendered.read_bytes())

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--mesh',required=True);parser.add_argument('--views',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();Path(args.output).parent.mkdir(parents=True,exist_ok=True);bake(Path(args.mesh),Path(args.views),Path(args.output))
