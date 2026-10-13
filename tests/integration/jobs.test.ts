import {it,expect,vi} from 'vitest';
import {Job} from 'bullmq';
import {spawn} from 'node:child_process';
import {acceptJobState} from '../../packages/contracts/src/index';
import {randomUUID} from 'node:crypto';
import {JobQueues} from '../../packages/jobs/src/index';
const input=(jobId:string,stage:'shape'|'texture'|'llm'='shape')=>({jobId,inputVersion:1,actor:'alice',roomId:'r',generation:0,stage,payload:{prompt:'chair'}});
it('recovers a job after a worker process exits without completing it',async()=>{
 const prefix='crash-'+randomUUID(),q=new JobQueues({prefix});await q.ready();
 const child=spawn(process.execPath,['--import','tsx','tests/fixtures/crash-job-worker.ts',prefix],{cwd:process.cwd(),stdio:'pipe',windowsHide:true});
 const exit=new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 let next:ReturnType<JobQueues['worker']>|undefined;
 try{
  const id=await q.enqueue(input('crash'));expect(await exit).toBe(24);
  expect((await q.status(id))?.status).not.toBe('completed');
  next=q.worker('gpu',async()=>({artifact:'recovered'}),{lockDuration:400,stalledInterval:400});
  await expect.poll(async()=>(await q.status(id))?.status,{timeout:10000}).toBe('completed');
  expect((await q.status(id))?.result).toEqual({artifact:'recovered'});
 }finally{if(child.exitCode===null)child.kill();await next?.close();await q.close();}
},15000);
it('does not regress terminal progress when older messages arrive',()=>{
 const completed={jobId:'j',stage:'shape' as const,inputVersion:1,status:'completed' as const,position:0,attempts:1,result:{artifact:'a'}};
 expect(acceptJobState(completed,{...completed,status:'running'})).toEqual(completed);
 expect(acceptJobState(completed,{...completed,inputVersion:0,status:'queued'})).toEqual(completed);
 expect(acceptJobState(completed,{...completed,inputVersion:2,status:'queued'}).status).toBe('queued');
});
it('does not read a stale result when completion races a status poll',async()=>{
 const q=new JobQueues({prefix:'race-'+randomUUID()});await q.ready();
 let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
 const w=q.worker('gpu',async()=>{await gate;return {artifact:'finished'};});
 try{
  const id=await q.enqueue(input('race'));await expect.poll(async()=>(await q.status(id))?.status).toBe('running');
  const completed=new Promise<void>(resolve=>w.once('completed',()=>resolve()));
  const original=Job.prototype.getState;
  const spy=vi.spyOn(Job.prototype,'getState').mockImplementationOnce(async function(this:Job){release();await completed;return original.call(this);});
  try{expect(await q.status(id)).toMatchObject({status:'completed',result:{artifact:'finished'}});}finally{spy.mockRestore();}
 }finally{release();await w.close();await q.close();}
});
it('deduplicates concurrent stage requests, rejects changed input, persists completion on reopen',async()=>{
 const name='test-'+randomUUID(),q=new JobQueues({prefix:name});let runs=0;
 await q.ready();const worker=q.worker('gpu',async()=>{runs++;return {artifact:'hash'};});
 try{
  const jobs=await Promise.all(Array.from({length:8},()=>q.enqueue(input('one'))));expect(new Set(jobs).size).toBe(1);
  await expect.poll(async()=>(await q.status(jobs[0]))?.status).toBe('completed');expect(runs).toBe(1);
  await expect(q.enqueue({...input('one'),payload:{prompt:'changed'}})).rejects.toThrow('JOB_INPUT_CONFLICT');
  const second=new JobQueues({prefix:name});await second.ready();try{expect((await second.status(jobs[0]))?.result).toEqual({artifact:'hash'});expect(await second.enqueue(input('one'))).toBe(jobs[0]);}finally{await second.close();}
 }finally{await worker.close();await q.close();}
});
it('serializes GPU stages across workers and isolates the LLM concurrency budget',async()=>{
 const q=new JobQueues({prefix:'test-'+randomUUID(),llmConcurrency:2});await q.ready();let active=0,max=0,llmActive=0,llmMax=0;
 const work=async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,35));active--;return {ok:true};};
 const a=q.worker('gpu',work),b=q.worker('gpu',work),l=q.worker('llm',async()=>{llmActive++;llmMax=Math.max(llmMax,llmActive);await new Promise(r=>setTimeout(r,35));llmActive--;return {ok:true};});
 try{
  const ids=await Promise.all(Array.from({length:6},(_,i)=>q.enqueue(input('gpu'+i,i%2?'shape':'texture'))));
  const llm=await Promise.all(Array.from({length:4},(_,i)=>q.enqueue(input('llm'+i,'llm'))));
  await expect.poll(async()=>Promise.all([...ids,...llm].map(async id=>(await q.status(id))?.status))).toEqual(Array(10).fill('completed'));
  expect(max).toBe(1);expect(llmMax).toBe(2);
  await a.close();const restarted=q.worker('gpu',work);try{const id=await q.enqueue(input('after'));await expect.poll(async()=>(await q.status(id))?.status).toBe('completed');expect(max).toBe(1);}finally{await restarted.close();}
 }finally{await Promise.all([a.close(),b.close(),l.close()]);await q.close();}
});
it('records failure, never publishes partial results, and bounds retries',async()=>{
 const q=new JobQueues({prefix:'test-'+randomUUID()});await q.ready();let runs=0;
 const w=q.worker('gpu',async()=>{runs++;throw Error('GPU_OOM');});
 try{const id=await q.enqueue(input('bad'));await expect.poll(async()=>(await q.status(id))?.status).toBe('failed');const state=await q.status(id);expect(state?.error).toContain('GPU_OOM');expect(state?.result).toBeUndefined();expect(runs).toBe(2);}
 finally{await w.close();await q.close();}
});
