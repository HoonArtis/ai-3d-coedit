from pathlib import Path
import pytest
from PIL import Image
from workers.gpu.adapters.images import load_image, generate_image
from workers.gpu.adapters.background import prepare_foreground
from workers.gpu.adapters.shape import save_shape

def test_image_upload_validation(tmp_path):
    good = tmp_path / 'image.png'
    Image.new('RGB', (32, 32), 'red').save(good)
    assert load_image(good).size == (32, 32)
    bad = tmp_path / 'bad.png'; bad.write_bytes(b'not an image')
    with pytest.raises(ValueError, match='INVALID_IMAGE'): load_image(bad)
    gif = tmp_path / 'test.gif'; Image.new('RGB',(32,32)).save(gif)
    with pytest.raises(ValueError, match='UNSUPPORTED_IMAGE'): load_image(gif)
    with pytest.raises(ValueError, match='EMPTY_PROMPT'): generate_image('', tmp_path / 'out.png')

def test_alpha_input_skips_restricted_model_and_rejects_empty_foreground(tmp_path):
    image = Image.new('RGBA',(32,32),(0,0,0,0))
    image.paste((230,20,30,255),(8,8,24,24))
    source=tmp_path/'alpha.png'; image.save(source)
    output=tmp_path/'prepared.png'
    result=prepare_foreground(source,output)
    assert result['model']=='provided-alpha'
    assert Image.open(output).size==(512,512)
    Image.new('RGBA',(32,32),(0,0,0,0)).save(source)
    with pytest.raises(ValueError,match='EMPTY_FOREGROUND'):prepare_foreground(source,output)

def test_keep_alpha_returns_transparent_texture_reference(tmp_path):
    image = Image.new('RGBA',(32,32),(0,0,0,0))
    image.paste((230,20,30,255),(8,8,24,24))
    source=tmp_path/'alpha.png'; image.save(source)
    output=tmp_path/'reference.png'
    result=prepare_foreground(source,output,keep_alpha=True)
    prepared=Image.open(output)
    assert result['alpha'] and prepared.mode=='RGBA' and prepared.size==(768,768)
    assert prepared.getpixel((0,0))[3]==0 and prepared.getpixel((384,384))[3]==255

def test_invalid_shape_never_publishes_glb(tmp_path):
    import trimesh,numpy as np
    output=tmp_path/'bad.glb'
    for mesh in [trimesh.Trimesh(),trimesh.Trimesh(vertices=[[float('nan'),0,0],[0,1,0],[1,0,0]],faces=[[0,1,2]],process=False)]:
        with pytest.raises(ValueError,match='INVALID_SHAPE'):save_shape(mesh,output)
        assert not output.exists()
    assert save_shape(trimesh.creation.box(),output)==12
    assert output.read_bytes()[:4]==b'glTF'

def test_missing_background_model_fails_before_inference(tmp_path,monkeypatch):
    import workers.gpu.adapters.background as background
    monkeypatch.setattr(background,'ROOT',tmp_path)
    source=tmp_path/'opaque.png';Image.new('RGB',(32,32),'red').save(source)
    with pytest.raises(ValueError,match='MODEL_MISSING'):background.prepare_foreground(source,tmp_path/'out.png')
    assert not (tmp_path/'out.png').exists()
