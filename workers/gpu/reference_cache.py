class ReferenceCache:
    """Output accumulator, deliberately not a Mapping input.

    Accelerate reconstructs input dictionaries on transfer. Reference attention
    writes must remain visible to the caller, and values are already on GPU.
    """
    def __init__(self): self._values={}
    def __setitem__(self,key,value): self._values[key]=value
    def items(self): return self._values.items()
