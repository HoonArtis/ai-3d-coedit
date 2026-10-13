"""Read DXGI adapter identities/LUIDs without changing Windows GPU preferences."""
import ctypes as c,json,uuid
class GUID(c.Structure):_fields_=[('data',c.c_ubyte*16)]
class LUID(c.Structure):_fields_=[('low',c.c_uint32),('high',c.c_int32)]
class Desc(c.Structure):_fields_=[('name',c.c_wchar*128),('vendor',c.c_uint32),('device',c.c_uint32),('subsystem',c.c_uint32),('revision',c.c_uint32),('video',c.c_size_t),('system',c.c_size_t),('shared',c.c_size_t),('luid',LUID),('flags',c.c_uint32)]
def call(ptr,index,result,args,*values):
    table=c.cast(ptr,c.POINTER(c.POINTER(c.c_void_p))).contents
    return c.WINFUNCTYPE(result,c.c_void_p,*args)(table[index])(ptr,*values)
iid=GUID((c.c_ubyte*16).from_buffer_copy(uuid.UUID('770aae78-f26f-4dba-a829-253c83d1b387').bytes_le));factory=c.c_void_p()
hr=c.windll.dxgi.CreateDXGIFactory1(c.byref(iid),c.byref(factory))
if hr:raise RuntimeError(hex(hr))
rows=[]
try:
 for i in range(16):
    adapter=c.c_void_p();hr=call(factory,12,c.c_int32,[c.c_uint,c.POINTER(c.c_void_p)],i,c.byref(adapter))
    if hr:break
    try:
        desc=Desc();hr=call(adapter,10,c.c_int32,[c.POINTER(Desc)],c.byref(desc))
        if hr:raise RuntimeError(hex(hr))
        rows.append({'name':desc.name,'vendor':desc.vendor,'device':desc.device,'luid':str(desc.luid.high)+','+str(desc.luid.low),'videoBytes':desc.video,'sharedBytes':desc.shared,'software':bool(desc.flags&2)})
    finally:call(adapter,2,c.c_uint32,[])
finally:call(factory,2,c.c_uint32,[])
print(json.dumps(rows,indent=2))
