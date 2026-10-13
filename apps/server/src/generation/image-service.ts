import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {validateCharacterUpload,objectKeySchema,type GenerationRecord,type JobInput,type Session} from '@coedit/contracts';
import type {JobQueues} from '@coedit/jobs';
import type {ObjectStore} from '@coedit/artifacts';
import {GenerationRepository} from './repository';
import {validateGenerationPrompt} from './prompt-filter';
import type {FinishingService} from './finishing-service';
type Scope=Session&{roomKey:string};
export async function normalizeUpload(bytes:Uint8Array):Promise<Buffer>{
 if(!bytes.length||bytes.length>10*1024*1024)throw Error('IMAGE_SIZE');
 const image=sharp(bytes,{failOn:'warning',limitInputPixels:8388608,animated:false}),meta=await image.metadata();
 if(!['png','jpeg','webp'].includes(meta.format??'')||!meta.width||!meta.height||meta.width<16||meta.height<16||(meta.pages??1)>1)throw Error('IMAGE_FORMAT');
 return image.rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).png().toBuffer();
}
export class ImageService{
 private running:Promise<void>|undefined;
 constructor(readonly repository:GenerationRepository,private queues:JobQueues,private store:ObjectStore,readonly finishing?:FinishingService){}
 async text(scope:Scope,generation:number,requestId:string,prompt:string,retry?:{jobId:string;expectedVersion:number}){
  const result=await this.repository.reserve(scope,generation,{requestId,source:{kind:'text',prompt:validateGenerationPrompt(prompt)},...retry});
  // Durable row is the outbox. A disconnected Redis must not lose or refund it.
  await this.dispatch(result).catch(()=>{});return result;
 }
 async upload(scope:Scope,generation:number,requestId:string,bytes:Uint8Array){
  await this.repository.usage(scope); // Authenticate before decode/store work.
  const normalized=await normalizeUpload(bytes),imageKey=createHash('sha256').update(normalized).digest('hex');
  return this.repository.reserve(scope,generation,{requestId,source:{kind:'upload',imageKey}},async()=>{if(await this.store.put(normalized)!==imageKey)throw Error('OBJECT_KEY_MISMATCH');});
 }
 async uploadCharacter(scope:Scope,generation:number,requestId:string,bytes:Uint8Array,format:unknown,name:string){
  await this.repository.usage(scope);const accepted=validateCharacterUpload(bytes,format),inputKey=createHash('sha256').update(bytes).digest('hex');
  return this.repository.reserve(scope,generation,{requestId,source:{kind:'character',format:accepted,name,inputKey}},async()=>{if(await this.store.put(bytes)!==inputKey)throw Error('OBJECT_KEY_MISMATCH');});
 }
 async image(scope:Scope,id:string){const job=await this.repository.get(scope,id);if(!job.imageKey)throw Error('IMAGE_NOT_READY');return this.store.get(job.imageKey);}
 async confirm(scope:Scope,id:string,version:number){const result=await this.repository.confirm(scope,id,version);await this.dispatch(result).catch(()=>{});return result;}
 private input(job:GenerationRecord):JobInput{
  return {jobId:job.id,inputVersion:job.version,actor:job.actor,roomId:job.roomId,generation:job.generation,stage:job.state==='image_queued'?'image':'shape',payload:job.state==='image_queued'?{prompt:job.source.kind==='text'?job.source.prompt:''}:{imageKey:job.imageKey}};
 }
 private async dispatch(job:GenerationRecord){if(job.state==='image_queued'||job.state==='shape_queued')return this.queues.enqueue(this.input(job));}
 reconcile(){
  if(this.running)return this.running;
  this.running=(async()=>{
   for(const job of await this.repository.pending()){
    const id=await this.dispatch(job);if(!id)continue;
    const state=await this.queues.status(id);
    if(state?.status==='failed'){await this.repository.fail(job.id,job.version,job.state==='image_queued'?'IMAGE_FAILED':'SHAPE_FAILED');continue;}
    if(state?.status==='completed'){
     try{
      const key=objectKeySchema.parse((state.result as {key?:unknown}|null)?.key);await this.store.get(key);
      if(job.state==='image_queued')await this.repository.imageReady(job.id,job.version,key);else await this.repository.shapeReady(job.id,job.version,key);
     }catch{await this.repository.fail(job.id,job.version,'INVALID_WORKER_RESULT');}
    }
   }
  })().finally(()=>{this.running=undefined;});return this.running;
 }
 async progress(scope:Scope){
  const jobs=await this.repository.list(scope);
  return Promise.all(jobs.map(async job=>{
   const id=await this.dispatch(job);const queue=id?await this.queues.status(id):undefined;
   return {...job,position:queue?.position??0,running:queue?.status==='running',finishing:await this.finishing?.repository.find(scope,job.id,job.version)??null};
  }));
 }
}
