import {test,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {JobQueues} from '@coedit/jobs';
test('cancellation cannot use a stale queued observation to remove a completed job',async()=>{
 const queues=new JobQueues({prefix:'cancel-race-'+randomUUID()});await queues.ready();let calls=0,worker:ReturnType<JobQueues['worker']>|undefined;
 const id=await queues.enqueue({jobId:'job',inputVersion:1,actor:'student',roomId:'room',generation:0,stage:'image',payload:{prompt:'whale'}}),status=queues.status.bind(queues);
 queues.status=async key=>{const stale=await status(key);if(stale?.status==='queued'){
  worker=queues.worker('gpu',async()=>{calls++;return {key:'a'.repeat(64)};});
  await expect.poll(async()=>(await status(key))?.status).toBe('completed');
 }return stale;};
 try{await queues.cancelQueued(id);expect(calls).toBe(0);expect(await status(id)).toBeUndefined();}
 finally{await worker?.close();await queues.close();}
});
test('already running and completed jobs retain their result when cancellation is attempted',async()=>{
 const queues=new JobQueues({prefix:'cancel-active-'+randomUUID()});await queues.ready();let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const worker=queues.worker('gpu',async()=>{await gate;return {key:'b'.repeat(64)};});
 try{const id=await queues.enqueue({jobId:'job',inputVersion:1,actor:'student',roomId:'room',generation:0,stage:'image',payload:{prompt:'whale'}});await expect.poll(async()=>(await queues.status(id))?.status).toBe('running');await expect(queues.cancelQueued(id)).rejects.toThrow('JOB_PROCESSING');release();await expect.poll(async()=>(await queues.status(id))?.status).toBe('completed');await expect(queues.cancelQueued(id)).rejects.toThrow('JOB_PROCESSING');expect((await queues.status(id))?.result).toEqual({key:'b'.repeat(64)});}finally{release();await worker.close();await queues.close();}
});
