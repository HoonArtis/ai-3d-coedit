import argparse,json,time,sys
from pathlib import Path
from .adapters.images import generate_image
from .adapters.background import prepare_foreground
from .adapters.shape import generate_shape

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('stage',choices=['image','background','shape']);parser.add_argument('--input');parser.add_argument('--prompt');parser.add_argument('--output',required=True);parser.add_argument('--seed',type=int,default=42);parser.add_argument('--steps',type=int)
    args=parser.parse_args();start=time.perf_counter()
    import torch
    if torch.cuda.is_available():torch.cuda.reset_peak_memory_stats()
    try:
        if args.stage=='image':result=generate_image(args.prompt or '',Path(args.output),args.seed,args.steps or 25)
        elif args.stage=='background':result=prepare_foreground(Path(args.input),Path(args.output))
        else:result=generate_shape(Path(args.input),Path(args.output),args.seed,args.steps or 30)
    except torch.cuda.OutOfMemoryError:
        print(json.dumps({'error':'GPU_OUT_OF_MEMORY','stage':args.stage}),file=sys.stderr)
        sys.exit(75)
    result['seconds']=round(time.perf_counter()-start,3)
    if torch.cuda.is_available():
        result['gpu']=torch.cuda.get_device_name()
        result['peakAllocatedMiB']=round(torch.cuda.max_memory_allocated()/1024**2,1)
        result['peakReservedMiB']=round(torch.cuda.max_memory_reserved()/1024**2,1)
    Path(args.output+'.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
