from pathlib import Path
from .images import ROOT,load_image

def save_shape(mesh,output:Path):
    import numpy as np
    if not len(mesh.faces) or not np.isfinite(mesh.vertices).all(): raise ValueError('INVALID_SHAPE')
    mesh.remove_unreferenced_vertices()
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True);mesh.export(output,file_type='glb')
    return len(mesh.faces)

def generate_shape(source:Path,output:Path,seed:int=42,steps:int=50):
    import sys,torch,trimesh,numpy as np
    sys.path.insert(0,str(ROOT/'.cache/TripoSG'))
    from triposg.pipelines.pipeline_triposg import TripoSGPipeline
    image=load_image(source).convert('RGB')
    weights=ROOT/'.cache/models/triposg'
    if not (weights/'model_index.json').is_file(): raise ValueError('MODEL_MISSING')
    pipeline=TripoSGPipeline.from_pretrained(str(weights),local_files_only=True).to('cuda',torch.float16)
    with torch.inference_mode():
        result=pipeline(image=image,generator=torch.Generator('cuda').manual_seed(seed),num_inference_steps=steps,use_flash_decoder=False,dense_octree_depth=7,hierarchical_octree_depth=8).samples[0]
    mesh=result if isinstance(result,trimesh.Trimesh) else trimesh.Trimesh(result[0],result[1])
    triangles=save_shape(mesh,output)
    return {'model':'VAST-AI/TripoSG','revision':'2c1c516d22d58db486a058d98d31bb6177344e06','decoder':'hierarchical-scikit-image','octreeDepth':[7,8],'triangles':triangles,'seed':seed,'steps':steps}
