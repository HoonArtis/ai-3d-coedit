from accelerate.utils import send_to_device
from workers.gpu.reference_cache import ReferenceCache

def test_reference_cache_preserves_writes_through_offload_argument_transfer():
    original=ReferenceCache()
    forwarded=send_to_device({'cache_hidden_states':original},'cpu')
    forwarded['cache_hidden_states']['layer']=42
    assert dict(original.items())=={'layer':42}
