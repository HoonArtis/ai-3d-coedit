import {JobQueues,runWorkerProcess} from '@coedit/jobs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
const queues=new JobQueues({prefix:'gpu-recovery-'+randomUUID()}),python=resolve('.venv/Scripts/python.exe');
await queues.ready();
const worker=queues.worker('gpu',async input=>{
 if(input.payload.forceOOM){
  // An impossible allocation raises real CUDA OOM without occupying the device.
  const code="import torch,sys,json\ntry:\n torch.empty(torch.cuda.get_device_properties(0).total_memory*128,dtype=torch.uint8,device='cuda')\nexcept torch.cuda.OutOfMemoryError:\n print(json.dumps({'error':'GPU_OUT_OF_MEMORY'}),file=sys.stderr);sys.exit(75)\nraise RuntimeError('Expected CUDA OOM did not occur')";
  return runWorkerProcess(python,['-c',code],{cwd:process.cwd(),timeoutMs:30000});
 }
 await runWorkerProcess(python,['-m','workers.gpu.run_stage','shape','--input','.cache/smoke/foreground.png','--output','.cache/smoke/after-oom.glb'],{cwd:process.cwd(),timeoutMs:180000});
 return JSON.parse(await readFile('.cache/smoke/after-oom.glb.json','utf8'));
});
const wait=async(id:string)=>{for(let i=0;i<480;i++){const state=await queues.status(id);if(state?.status==='completed'||state?.status==='failed')return state;await new Promise(r=>setTimeout(r,500));}throw Error('TIMEOUT');};
try{
 const input={actor:'gpu-diagnostic',roomId:'diagnostic',generation:0,inputVersion:1,stage:'shape' as const};
 const failed=await wait(await queues.enqueue({...input,jobId:randomUUID(),payload:{forceOOM:true}}));
 console.log('OOM observation',JSON.stringify(failed));
 if(failed.status!=='failed'||!failed.error?.includes('GPU_OUT_OF_MEMORY')||failed.attempts!==2)throw Error('OOM_NOT_CLASSIFIED');
 const recovered=await wait(await queues.enqueue({...input,jobId:randomUUID(),payload:{}}));
 if(recovered.status!=='completed')throw Error('RECOVERY_FAILED');
 const report={date:new Date().toISOString(),failure:failed,recovery:recovered,condition:'Real CUDA impossible allocation in separate process; same BullMQ worker then runs actual TripoSG on saved foreground. Peak PyTorch memory is not total device usage.'};
 await writeFile('docs/evidence/gpu-memory-recovery.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await worker.close();await queues.close();}
