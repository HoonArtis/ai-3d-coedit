import {createHash} from 'node:crypto';
import {Queue,Worker,type ConnectionOptions} from 'bullmq';
import {jobInputSchema,type JobInput,type JobState} from '../../contracts/src/index';
type Lane='gpu'|'llm'|'cpu';
const lane=(stage:JobInput['stage']):Lane=>stage==='llm'?'llm':['image','shape','texture'].includes(stage)?'gpu':'cpu';
const canonical=(value:unknown):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}':JSON.stringify(value);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
export class JobQueues{
 private queues:Record<Lane,Queue<JobInput>>;
 private connection:ConnectionOptions;
 private prefix:string;
 constructor(private options:{prefix?:string;connection?:ConnectionOptions;llmConcurrency?:number}={}){
  this.connection=options.connection??{host:'127.0.0.1',port:63799,maxRetriesPerRequest:1,enableOfflineQueue:false};
  this.prefix=options.prefix??'coedit';
  this.queues=Object.fromEntries(['gpu','llm','cpu'].map(name=>[name,new Queue<JobInput>(name,{connection:this.connection,prefix:this.prefix})])) as Record<Lane,Queue<JobInput>>;
 }
 async ready(){await Promise.all(Object.entries(this.queues).map(async([name,q])=>{await q.waitUntilReady();await q.setGlobalConcurrency(name==='gpu'?1:name==='llm'?(this.options.llmConcurrency??2):2);}));}
 async enqueue(value:unknown):Promise<string>{
  const input=jobInputSchema.parse(value),target=lane(input.stage);
  const id=target+'-'+hash([input.roomId,input.actor,input.jobId,input.inputVersion,input.stage]);
  const q=this.queues[target];
  await q.add(input.stage,input,{jobId:id,attempts:2,backoff:{type:'fixed',delay:100},removeOnComplete:false,removeOnFail:false});
  const persisted=await q.getJob(id);
  if(!persisted||hash(persisted.data)!==hash(input))throw Error('JOB_INPUT_CONFLICT');
  return id;
 }
 async status(id:string):Promise<JobState|undefined>{
  const target=id.split('-')[0] as Lane;if(!Object.hasOwn(this.queues,target))return;
  const q=this.queues[target];let job=await q.getJob(id);if(!job)return;
  const state=await job.getState();
  const status=state==='completed'?'completed':state==='failed'?'failed':state==='active'?'running':'queued';
  // getState reads Redis after getJob: a worker can complete between those calls.
  if(status==='completed'||status==='failed'){job=await q.getJob(id);if(!job)return;}
  const waiting=status==='queued'?await q.getWaiting():[];
  return {jobId:id,stage:job.data.stage,inputVersion:job.data.inputVersion,status,position:status==='queued'?Math.max(1,waiting.findIndex(j=>j.id===id)+1):0,attempts:job.attemptsMade,...(status==='completed'?{result:job.returnvalue}:{}),...(status==='failed'?{error:job.failedReason}:{})};
 }
 worker(target:Lane,run:(input:JobInput,executionId:string)=>Promise<unknown>,timing:{lockDuration?:number;stalledInterval?:number}={}){
  const worker=new Worker<JobInput>(target,async job=>run(jobInputSchema.parse(job.data),job.id!),{connection:{...this.connection,maxRetriesPerRequest:null},prefix:this.prefix,concurrency:target==='gpu'?1:target==='llm'?(this.options.llmConcurrency??2):2,maxStalledCount:1,...timing});
  // Keep connection failures observable without an unhandled EventEmitter crash.
  worker.on('error',error=>console.error('Worker connection:',error.message));
  return worker;
 }
 async close(){await Promise.all(Object.values(this.queues).map(q=>q.close()));}
}
