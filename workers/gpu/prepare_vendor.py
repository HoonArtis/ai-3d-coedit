"""Fetch the audited MIT source and make its optional flash decoder import lazy.
No DISO, RMBG weights, or other dependencies are implicitly installed here.
"""
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[2]
REVISION='fc5c40990181e2a756c4e0b1c2f4d6b5202faf8c'

def prepare():
    vendor=ROOT/'.cache/TripoSG'
    if not vendor.exists():
        subprocess.run(['git','clone','https://github.com/VAST-AI-Research/TripoSG.git',str(vendor)],check=True)
        subprocess.run(['git','checkout','--detach',REVISION],cwd=vendor,check=True)
    actual=subprocess.check_output(['git','rev-parse','HEAD'],cwd=vendor,text=True).strip()
    if actual!=REVISION: raise RuntimeError('Unexpected TripoSG revision; preserve local changes and inspect before proceeding')
    path=vendor/'triposg/inference_utils.py'
    original='from diso import DiffDMC'
    patched='try:\n    from diso import DiffDMC\nexcept ImportError:\n    DiffDMC = None'
    source=path.read_text(encoding='utf-8')
    # Existing smoke-run patch has identical semantics; normalize only this import.
    if patched not in source:
        if source.count(original)!=1: raise RuntimeError('Unexpected upstream decoder import')
        if 'except ImportError' in source[source.find(original):source.find(original)+100]:
            print('Optional DISO import already patched; inspect git diff for provenance')
        else: path.write_text(source.replace(original,patched),encoding='utf-8')
    print(str(vendor),actual)

def prepare_texture():
    vendor=ROOT/'.cache/MV-Adapter';revision='4277e0018232bac82bb2c103caf0893cedb711be'
    if not vendor.exists():
        subprocess.run(['git','clone','https://github.com/huanngzh/MV-Adapter.git',str(vendor)],check=True)
        subprocess.run(['git','checkout','--detach',revision],cwd=vendor,check=True)
    if subprocess.check_output(['git','rev-parse','HEAD'],cwd=vendor,text=True).strip()!=revision:raise RuntimeError('Unexpected MV-Adapter revision')
    path=vendor/'mvadapter/utils/mesh_utils/mesh_process.py';source=path.read_text(encoding="utf-8")
    original='from pymeshlab import Percentage';patched='from pymeshlab import PercentageValue as Percentage'
    if patched not in source:
        if source.count(original)!=1:raise RuntimeError('Unexpected PyMeshLab import')
        path.write_text(source.replace(original,patched),encoding="utf-8")
    source=path.read_text(encoding='utf-8')
    original='    v_tex_np = (\n        uv_parameterize_uvatlas(v_pos, t_pos_idx)'
    patched='    from workers.gpu.uv_mesh import clean_uv_faces\n    t_pos_idx = clean_uv_faces(v_pos, t_pos_idx)\n\n'+original
    if '    t_pos_idx = clean_uv_faces(v_pos, t_pos_idx)' not in source:
        if source.count(original)!=1:raise RuntimeError('Unexpected UVAtlas preparation')
        path.write_text(source.replace(original,patched),encoding='utf-8')
    path=vendor/'mvadapter/pipelines/pipeline_mvadapter_i2mv_sdxl.py';source=path.read_text(encoding='utf-8')
    original='            ref_hidden_states = {}'
    patched='            from workers.gpu.reference_cache import ReferenceCache\n            ref_hidden_states = ReferenceCache()'
    if patched not in source:
        if source.count(original)!=1:raise RuntimeError('Unexpected reference cache initialization')
        path.write_text(source.replace(original,patched),encoding='utf-8')
    path=vendor/'mvadapter/utils/mesh_utils/uv.py';source=path.read_text(encoding='utf-8')
    original='    from .cv_ops import inpaint_cvc'
    patched='    from workers.gpu.uv_padding import inpaint_cpu as inpaint_cvc'
    if patched not in source:
        if source.count(original)!=1:raise RuntimeError('Unexpected UV padding import')
        path.write_text(source.replace(original,patched),encoding='utf-8')
    print(str(vendor),revision,'PercentageValue, offload reference cache, CPU UV padding, collapsed UV triangle patches')

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--texture',action='store_true');args=parser.parse_args()
    prepare_texture() if args.texture else prepare()
