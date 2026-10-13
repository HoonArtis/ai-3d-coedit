"""Explicit CPU UV padding adapter for CV-CUDA binaries lacking sm_120 kernels."""
import cv2
import torch

def inpaint_cpu(image,mask,padding_size,return_dtype=None):
    if image.ndim!=3 or image.shape[-1]!=3 or mask.shape!=image.shape[:2] or not 0<padding_size<=100:
        raise ValueError('UV_PADDING_INPUT')
    if not torch.isfinite(image).all():raise ValueError('UV_PADDING_INPUT')
    byte_image=image.detach() if image.dtype==torch.uint8 else (image.detach().clamp(0,1)*255).to(torch.uint8)
    byte_mask=(mask.detach()!=0).to(torch.uint8)*255
    result=cv2.inpaint(byte_image.cpu().numpy(),byte_mask.cpu().numpy(),padding_size,cv2.INPAINT_TELEA)
    output=torch.from_numpy(result).to(image.device)
    if return_dtype==torch.uint8 or image.dtype==torch.uint8:return output
    output=output.to(image.dtype)/255
    return torch.where((mask!=0)[...,None],output,image.detach())
