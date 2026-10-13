import torch
import pytest
from workers.gpu.uv_padding import inpaint_cpu

def test_padding_preserves_observed_pixels_and_device():
    image=torch.ones((16,16,3),dtype=torch.float32)*.8
    image[7:9,7:9]=0
    mask=torch.zeros((16,16),dtype=torch.bool);mask[7:9,7:9]=True
    result=inpaint_cpu(image,mask,3)
    assert result.shape==image.shape and result.dtype==image.dtype and result.device==image.device
    assert torch.equal(result[~mask],image[~mask])
    assert result[mask].mean()>.7
    assert torch.isfinite(result).all()

def test_padding_rejects_invalid_mask():
    with pytest.raises(ValueError,match='UV_PADDING_INPUT'):
        inpaint_cpu(torch.zeros((16,16,3)),torch.zeros((8,8)),3)
