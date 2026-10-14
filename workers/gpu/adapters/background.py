from pathlib import Path
from PIL import Image
import numpy as np
from .images import load_image, ROOT

def prepare_foreground(source: Path, output: Path, keep_alpha: bool = False):
    """keep_alpha: transparent RGBA for MV-Adapter, which crops by alpha and fills its own grey background."""
    image=load_image(source)
    alpha=np.asarray(image.getchannel('A'))
    if alpha.max()==0: raise ValueError('EMPTY_FOREGROUND')
    model='provided-alpha'
    if alpha.min()==255:
        weights=ROOT/'.cache/models/rmbg'
        if not (weights/'model.safetensors').is_file(): raise ValueError('MODEL_MISSING')
        import sys, torch
        import torch.nn.functional as F
        sys.path.insert(0,str(ROOT/'.cache/TripoSG/scripts'))
        from briarmbg import BriaRMBG
        net=BriaRMBG.from_pretrained(str(weights),local_files_only=True).to('cuda').eval()
        rgb=torch.from_numpy(np.array(image.convert('RGB'))).permute(2,0,1).unsqueeze(0).float().to('cuda')/255
        resized=F.interpolate(rgb,size=(1024,1024),mode='bilinear',align_corners=False)-0.5
        with torch.inference_mode(): mask=net(resized)[0][0]
        mask=F.interpolate(mask,size=(image.height,image.width),mode='bilinear',align_corners=False).squeeze()
        low,high=mask.min(),mask.max()
        if float(high-low)<1e-6: raise ValueError('EMPTY_FOREGROUND')
        alpha=((mask-low)/(high-low)*255).clamp(0,255).byte().cpu().numpy()
        model='briaai/RMBG-1.4 (research-only)'
    mask=Image.fromarray(alpha).point(lambda v:255 if v>128 else 0)
    box=mask.getbbox()
    if not box or np.count_nonzero(np.array(mask))<image.width*image.height*0.005: raise ValueError('EMPTY_FOREGROUND')
    image.putalpha(Image.fromarray(alpha));cropped=image.crop(box)
    side=max(cropped.size);canvas=Image.new('RGBA',(int(side*1.2),int(side*1.2)),(0,0,0,0) if keep_alpha else (255,255,255,255))
    canvas.alpha_composite(cropped,((canvas.width-cropped.width)//2,(canvas.height-cropped.height)//2))
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    size=768 if keep_alpha else 512
    (canvas if keep_alpha else canvas.convert('RGB')).resize((size,size),Image.Resampling.LANCZOS).save(output,format='PNG')
    return {'model':model,'sourceSize':list(image.size),'preparedSize':[size,size],'alpha':keep_alpha}
